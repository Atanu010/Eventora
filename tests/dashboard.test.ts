import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool } from 'pg'

process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev'
process.env.JWT_SECRET ??= 'phase9-test-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN ??= '1h'

let app: Express
let pool: Pool
let organizerToken = ''
let otherOrganizerToken = ''
let attendeeToken = ''
let adminToken = ''
let ticketTypeId = ''
let qrToken = ''

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function register(email: string, role?: 'organizer' | 'admin'): Promise<{ token: string; id: string }> {
  const password = 'phase9-strong-password'
  const registration = await request(app).post('/api/auth/register').send({ name: email.split('@')[0], email, password })
  assert.equal(registration.status, 201)
  const id = registration.body.user.id as string
  if (role) await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id])
  const login = await request(app).post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200)
  return { token: login.body.accessToken, id }
}

async function cleanup(): Promise<void> {
  await pool.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase9-%@example.test')")
  await pool.query("DELETE FROM tickets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase9-%@example.test')")
  await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase9-%@example.test'))")
  await pool.query("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase9-%@example.test')")
  await pool.query("DELETE FROM ticket_types WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase9-%@example.test'))")
  await pool.query("DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase9-%@example.test')")
  await pool.query("DELETE FROM users WHERE email LIKE 'phase9-%@example.test'")
}

before(async () => {
  ;({ default: app } = await import('../server/src/app'))
  ;({ default: pool } = await import('../server/src/config/database'))
  await cleanup()
  organizerToken = (await register('phase9-organizer@example.test', 'organizer')).token
  otherOrganizerToken = (await register('phase9-other@example.test', 'organizer')).token
  attendeeToken = (await register('phase9-attendee@example.test')).token
  adminToken = (await register('phase9-admin@example.test', 'admin')).token
  const event = await request(app).post('/api/events').set(auth(organizerToken)).send({ title: 'Phase Nine Metrics', start_at: '2035-01-01T10:00:00Z', end_at: '2035-01-01T12:00:00Z' })
  assert.equal(event.status, 201)
  const eventId = event.body.event.id as string
  assert.equal((await request(app).patch(`/api/events/${eventId}`).set(auth(organizerToken)).send({ status: 'published' })).status, 200)
  const ticket = await request(app).post(`/api/events/${eventId}/ticket-types`).set(auth(organizerToken)).send({ name: 'General', price: 25, quantity: 5, sales_start_at: '2020-01-01T00:00:00Z', sales_end_at: '2099-01-01T00:00:00Z' })
  assert.equal(ticket.status, 201)
  ticketTypeId = ticket.body.ticketType.id
  const order = await request(app).post('/api/orders').set(auth(attendeeToken)).send({ items: [{ ticketTypeId, quantity: 2 }] })
  assert.equal(order.status, 201)
  const { confirmOrderForDevelopment } = await import('../server/src/services/order.service')
  await confirmOrderForDevelopment(order.body.order.id)
  const ticketRow = await pool.query<{ qr_token: string }>('SELECT qr_token FROM tickets WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1) ORDER BY ticket_number LIMIT 1', [order.body.order.id])
  qrToken = ticketRow.rows[0].qr_token
})

after(async () => { await cleanup(); await pool.end() })

describe('dashboard', () => {
  it('rejects attendees and scopes organizers to their own events', async () => {
    const attendee = await request(app).get('/api/dashboard/summary').set(auth(attendeeToken))
    const other = await request(app).get('/api/dashboard/summary').set(auth(otherOrganizerToken))
    assert.equal(attendee.status, 403)
    assert.equal(other.status, 200)
    assert.equal(other.body.totals.events, 0)
  })

  it('returns authoritative sales and inventory metrics for the owner', async () => {
    const checkIn = await request(app).post('/api/tickets/check-in').set(auth(organizerToken)).send({ qrToken })
    assert.equal(checkIn.status, 200)
    const response = await request(app).get('/api/dashboard/summary').set(auth(organizerToken))
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.totals, { events: 1, publishedEvents: 1, grossRevenue: '50.00', ticketsSold: 2, ticketsCheckedIn: 1, remainingInventory: 3 })
    assert.equal(response.body.events[0].title, 'Phase Nine Metrics')
    assert.equal(response.body.events[0].grossRevenue, '50.00')
  })

  it('allows admins to view all event metrics', async () => {
    const response = await request(app).get('/api/dashboard/summary').set(auth(adminToken))
    assert.equal(response.status, 200)
    assert.equal(response.body.events.some((event: { title: string }) => event.title === 'Phase Nine Metrics'), true)
  })
})