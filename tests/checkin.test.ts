import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool } from 'pg'

process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev'
process.env.JWT_SECRET ??= 'phase7-test-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN ??= '1h'

let app: Express
let pool: Pool
let organizerToken = ''
let secondOrganizerToken = ''
let attendeeToken = ''
let adminToken = ''
let ticketTypeId = ''
let ticketToken = ''
let ticketId = ''
let orderId = ''

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function registerAndLogin(email: string, role?: 'organizer' | 'admin'): Promise<string> {
  const password = 'phase7-strong-password'
  const registration = await request(app).post('/api/auth/register').send({ name: email.split('@')[0], email, password })
  assert.equal(registration.status, 201)
  if (role) await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, registration.body.user.id])
  const login = await request(app).post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200)
  return login.body.accessToken as string
}

async function createPaidTicket(ownerToken: string, title: string): Promise<{ orderId: string; ticketId: string; qrToken: string }> {
  const event = await request(app).post('/api/events').set(auth(ownerToken)).send({ title, start_at: '2033-01-01T10:00:00Z', end_at: '2033-01-01T12:00:00Z' })
  assert.equal(event.status, 201)
  const eventId = event.body.event.id as string
  const published = await request(app).patch(`/api/events/${eventId}`).set(auth(ownerToken)).send({ status: 'published' })
  assert.equal(published.status, 200)
  const ticketType = await request(app).post(`/api/events/${eventId}/ticket-types`).set(auth(ownerToken)).send({ name: title, price: 25, quantity: 5, sales_start_at: '2020-01-01T00:00:00Z', sales_end_at: '2099-01-01T00:00:00Z' })
  assert.equal(ticketType.status, 201)
  const created = await request(app).post('/api/orders').set(auth(attendeeToken)).send({ items: [{ ticketTypeId: ticketType.body.ticketType.id, quantity: 1 }] })
  assert.equal(created.status, 201)
  const { confirmOrderForDevelopment } = await import('../server/src/services/order.service')
  await confirmOrderForDevelopment(created.body.order.id)
  const ticket = await pool.query<{ id: string; qr_token: string }>('SELECT id, qr_token FROM tickets WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)', [created.body.order.id])
  return { orderId: created.body.order.id, ticketId: ticket.rows[0].id, qrToken: ticket.rows[0].qr_token }
}

async function cleanup(): Promise<void> {
  await pool.query("DELETE FROM tickets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase7-%@example.test')")
  await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase7-%@example.test'))")
  await pool.query("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase7-%@example.test')")
  await pool.query("DELETE FROM ticket_types WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase7-%@example.test'))")
  await pool.query("DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase7-%@example.test')")
  await pool.query("DELETE FROM users WHERE email LIKE 'phase7-%@example.test'")
}

before(async () => {
  ;({ default: app } = await import('../server/src/app'))
  ;({ default: pool } = await import('../server/src/config/database'))
  await cleanup()
  organizerToken = await registerAndLogin('phase7-organizer@example.test', 'organizer')
  secondOrganizerToken = await registerAndLogin('phase7-second-organizer@example.test', 'organizer')
  attendeeToken = await registerAndLogin('phase7-attendee@example.test')
  adminToken = await registerAndLogin('phase7-admin@example.test', 'admin')
  const ticket = await createPaidTicket(organizerToken, 'Phase Seven Primary')
  orderId = ticket.orderId
  ticketId = ticket.ticketId
  ticketToken = ticket.qrToken
  const type = await pool.query<{ id: string }>('SELECT ticket_type_id AS id FROM order_items WHERE order_id = $1', [orderId])
  ticketTypeId = type.rows[0].id
})

after(async () => {
  await cleanup()
  await pool.end()
})

describe('ticket check-in', () => {
  it('requires authentication and organizer/admin privileges', async () => {
    const anonymous = await request(app).post('/api/tickets/check-in').send({ qrToken: ticketToken })
    const attendee = await request(app).post('/api/tickets/check-in').set(auth(attendeeToken)).send({ qrToken: ticketToken })
    assert.equal(anonymous.status, 401)
    assert.equal(attendee.status, 403)
  })

  it('checks in an owned ticket and ignores client-supplied event data', async () => {
    const response = await request(app).post('/api/tickets/check-in').set(auth(organizerToken)).send({ qrToken: ticketToken, eventId: '00000000-0000-0000-0000-000000000000', status: 'active' })
    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.alreadyCheckedIn, false)
    assert.equal(response.body.ticketNumber.length > 0, true)
    assert.equal(response.body.eventTitle, 'Phase Seven Primary')
    assert.equal(response.body.ticketType, 'Phase Seven Primary')
    assert.equal(typeof response.body.attendeeName, 'string')
    assert.equal('qrToken' in response.body, false)
    assert.equal(JSON.stringify(response.body).includes('password_hash'), false)
    const stored = await pool.query<{ status: string; used_at: string }>('SELECT status, used_at FROM tickets WHERE id = $1', [ticketId])
    assert.equal(stored.rows[0].status, 'used')
    assert.equal(Boolean(stored.rows[0].used_at), true)
  })

  it('reports an already-used ticket without changing used_at', async () => {
    const beforeRepeat = await pool.query<{ used_at: string }>('SELECT used_at FROM tickets WHERE id = $1', [ticketId])
    const response = await request(app).post('/api/tickets/check-in').set(auth(organizerToken)).send({ qrToken: ticketToken })
    const afterRepeat = await pool.query<{ used_at: string }>('SELECT used_at FROM tickets WHERE id = $1', [ticketId])
    assert.equal(response.status, 200)
    assert.equal(response.body.alreadyCheckedIn, true)
    assert.equal(response.body.checkedInAt, new Date(beforeRepeat.rows[0].used_at).toISOString())
    assert.equal(new Date(afterRepeat.rows[0].used_at).getTime(), new Date(beforeRepeat.rows[0].used_at).getTime())
  })

  it('rejects invalid tokens, cancelled tickets, and another organizer', async () => {
    const invalid = await request(app).post('/api/tickets/check-in').set(auth(organizerToken)).send({ qrToken: 'unknown-token' })
    assert.equal(invalid.status, 404)
    const other = await createPaidTicket(organizerToken, 'Phase Seven Ownership')
    const forbidden = await request(app).post('/api/tickets/check-in').set(auth(secondOrganizerToken)).send({ qrToken: other.qrToken })
    assert.equal(forbidden.status, 403)
    await pool.query("UPDATE tickets SET status = 'cancelled' WHERE id = $1", [other.ticketId])
    const cancelled = await request(app).post('/api/tickets/check-in').set(auth(organizerToken)).send({ qrToken: other.qrToken })
    assert.equal(cancelled.status, 422)
  })

  it('allows an admin to check in any event ticket', async () => {
    const other = await createPaidTicket(organizerToken, 'Phase Seven Admin')
    const response = await request(app).post('/api/tickets/check-in').set(auth(adminToken)).send({ qrToken: other.qrToken })
    assert.equal(response.status, 200)
    assert.equal(response.body.alreadyCheckedIn, false)
  })

  it('allows only one state transition for concurrent scans', async () => {
    const other = await createPaidTicket(organizerToken, 'Phase Seven Concurrency')
    const results = await Promise.all([
      request(app).post('/api/tickets/check-in').set(auth(organizerToken)).send({ qrToken: other.qrToken }),
      request(app).post('/api/tickets/check-in').set(auth(organizerToken)).send({ qrToken: other.qrToken }),
    ])
    assert.equal(results.every((result) => result.status === 200), true)
    assert.equal(results.filter((result) => result.body.alreadyCheckedIn === false).length, 1)
    assert.equal(results.filter((result) => result.body.alreadyCheckedIn === true).length, 1)
    const stored = await pool.query<{ status: string; used_at: string }>('SELECT status, used_at FROM tickets WHERE id = $1', [other.ticketId])
    assert.equal(stored.rows[0].status, 'used')
    assert.equal(Boolean(stored.rows[0].used_at), true)
  })
})