import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool } from 'pg'
import { processPendingNotifications } from '../server/src/services/notification.service'

process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev'
process.env.JWT_SECRET ??= 'phase8-test-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN ??= '1h'

let app: Express
let pool: Pool
let userToken = ''
let otherToken = ''
let userId = ''
let orderId = ''
let ticketTypeId = ''

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function register(email: string): Promise<{ token: string; id: string }> {
  const password = 'phase8-strong-password'
  const registration = await request(app).post('/api/auth/register').send({ name: email.split('@')[0], email, password })
  assert.equal(registration.status, 201)
  const login = await request(app).post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200)
  return { token: login.body.accessToken, id: registration.body.user.id }
}

async function login(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password: 'phase8-strong-password' })
  assert.equal(response.status, 200)
  return response.body.accessToken as string
}

async function cleanup(): Promise<void> {
  await pool.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase8-%@example.test')")
  await pool.query("DELETE FROM tickets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase8-%@example.test')")
  await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase8-%@example.test'))")
  await pool.query("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase8-%@example.test')")
  await pool.query("DELETE FROM ticket_types WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase8-%@example.test'))")
  await pool.query("DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase8-%@example.test')")
  await pool.query("DELETE FROM users WHERE email LIKE 'phase8-%@example.test'")
}

before(async () => {
  ;({ default: app } = await import('../server/src/app'))
  ;({ default: pool } = await import('../server/src/config/database'))
  await cleanup()
  const user = await register('phase8-user@example.test')
  const other = await register('phase8-other@example.test')
  userToken = user.token
  userId = user.id
  otherToken = other.token
  const organizer = await register('phase8-organizer@example.test')
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['organizer', organizer.id])
  const organizerToken = await login('phase8-organizer@example.test')
  const event = await request(app).post('/api/events').set(auth(organizerToken)).send({ title: 'Phase Eight Notifications', start_at: '2034-01-01T10:00:00Z', end_at: '2034-01-01T12:00:00Z' })
  assert.equal(event.status, 201)
  await request(app).patch(`/api/events/${event.body.event.id}`).set(auth(organizerToken)).send({ status: 'published' })
  const ticketType = await request(app).post(`/api/events/${event.body.event.id}/ticket-types`).set(auth(organizerToken)).send({ name: 'General', price: 20, quantity: 5, sales_start_at: '2020-01-01T00:00:00Z', sales_end_at: '2099-01-01T00:00:00Z' })
  ticketTypeId = ticketType.body.ticketType.id
})

after(async () => {
  await cleanup()
  await pool.end()
})

describe('notifications', () => {
  it('creates a durable order notification and processes it for in-app delivery', async () => {
    const created = await request(app).post('/api/orders').set(auth(userToken)).send({ items: [{ ticketTypeId, quantity: 1 }] })
    assert.equal(created.status, 201)
    orderId = created.body.order.id
    const first = await request(app).get('/api/notifications').set(auth(userToken))
    assert.equal(first.status, 200)
    const orderNotification = first.body.data.find((item: { type: string }) => item.type === 'order.created')
    assert.ok(orderNotification)
    assert.equal(orderNotification.data.orderId, orderId)
    assert.equal(orderNotification.status, 'pending')
    assert.equal(await processPendingNotifications() >= 1, true)
    const processed = await request(app).get('/api/notifications?unread=true').set(auth(userToken))
    const processedOrder = processed.body.data.find((item: { type: string }) => item.type === 'order.created')
    assert.equal(processedOrder.status, 'delivered')
  })

  it('protects notification ownership and supports read state', async () => {
    const response = await request(app).get('/api/notifications').set(auth(otherToken))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.some((item: { data: { orderId?: string } }) => item.data.orderId === orderId), false)
    const own = await request(app).get('/api/notifications').set(auth(userToken))
    const notification = own.body.data.find((item: { data: { orderId?: string } }) => item.data.orderId === orderId)
    const forbidden = await request(app).post(`/api/notifications/${notification.id}/read`).set(auth(otherToken))
    assert.equal(forbidden.status, 404)
    const read = await request(app).post(`/api/notifications/${notification.id}/read`).set(auth(userToken))
    assert.equal(read.status, 204)
    const unread = await request(app).get('/api/notifications?unread=true').set(auth(userToken))
    assert.equal(unread.body.data.some((item: { id: string }) => item.id === notification.id), false)
  })

  it('does not duplicate lifecycle notifications for the same dedupe key', async () => {
    const countBefore = await pool.query("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND dedupe_key = $2", [userId, `order.created:${orderId}`])
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, dedupe_key)
       VALUES ($1, 'order.created', 'Duplicate', 'Ignored', $2)
       ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
      [userId, `order.created:${orderId}`],
    )
    const countAfter = await pool.query("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND dedupe_key = $2", [userId, `order.created:${orderId}`])
    assert.equal(countBefore.rows[0].count, 1)
    assert.equal(countAfter.rows[0].count, 1)
  })
})