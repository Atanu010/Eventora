import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool } from 'pg'

process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev'
process.env.JWT_SECRET ??= 'phase10-test-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN ??= '1h'

let app: Express
let pool: Pool
let adminToken = ''
let secondAdminToken = ''
let organizerToken = ''
let attendeeToken = ''
let otherOrganizerToken = ''
let organizerId = ''
let otherOrganizerId = ''
let attendeeId = ''
let eventId = ''
let ticketTypeId = ''

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function register(email: string, role?: 'organizer' | 'admin'): Promise<{ token: string; id: string }> {
  const password = 'phase10-strong-password'
  const registration = await request(app).post('/api/auth/register').send({ name: email.split('@')[0], email, password })
  assert.equal(registration.status, 201)
  const id = registration.body.user.id as string
  if (role) await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id])
  const login = await request(app).post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200)
  return { token: login.body.accessToken, id }
}

async function cleanup(): Promise<void> {
  await pool.query("DELETE FROM audit_logs WHERE admin_user_id IN (SELECT id FROM users WHERE email LIKE 'phase10-%@example.test')")
  await pool.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase10-%@example.test')")
  await pool.query("DELETE FROM tickets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase10-%@example.test')")
  await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase10-%@example.test'))")
  await pool.query("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase10-%@example.test')")
  await pool.query("DELETE FROM ticket_types WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase10-%@example.test'))")
  await pool.query("DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase10-%@example.test')")
  await pool.query("DELETE FROM users WHERE email LIKE 'phase10-%@example.test'")
}

before(async () => {
  ;({ default: app } = await import('../server/src/app'))
  ;({ default: pool } = await import('../server/src/config/database'))
  await cleanup()
  const admin = await register('phase10-admin@example.test', 'admin')
  const secondAdmin = await register('phase10-second-admin@example.test', 'admin')
  const organizer = await register('phase10-organizer@example.test', 'organizer')
  const otherOrganizer = await register('phase10-other-organizer@example.test', 'organizer')
  const attendee = await register('phase10-attendee@example.test')
  adminToken = admin.token
  secondAdminToken = secondAdmin.token
  organizerToken = organizer.token
  otherOrganizerToken = otherOrganizer.token
  attendeeToken = attendee.token
  organizerId = organizer.id
  otherOrganizerId = otherOrganizer.id
  attendeeId = attendee.id
  const event = await request(app).post('/api/events').set(auth(organizerToken)).send({ title: 'Phase Ten Moderation Event', start_at: '2036-01-01T10:00:00Z', end_at: '2036-01-01T12:00:00Z' })
  assert.equal(event.status, 201)
  eventId = event.body.event.id
  const ticket = await request(app).post(`/api/events/${eventId}/ticket-types`).set(auth(organizerToken)).send({ name: 'General', price: 30, quantity: 3, sales_start_at: '2020-01-01T00:00:00Z', sales_end_at: '2099-01-01T00:00:00Z' })
  assert.equal(ticket.status, 201)
  ticketTypeId = ticket.body.ticketType.id
})

after(async () => { await cleanup(); await pool.end() })

describe('admin authorization and dashboard', () => {
  it('blocks attendees and organizers from every admin surface', async () => {
    for (const token of [attendeeToken, organizerToken]) {
      assert.equal((await request(app).get('/api/admin/dashboard').set(auth(token))).status, 403)
      assert.equal((await request(app).get('/api/admin/users').set(auth(token))).status, 403)
      assert.equal((await request(app).get('/api/admin/events').set(auth(token))).status, 403)
      assert.equal((await request(app).get('/api/admin/orders').set(auth(token))).status, 403)
      assert.equal((await request(app).get('/api/admin/tickets').set(auth(token))).status, 403)
      assert.equal((await request(app).get('/api/admin/audit-logs').set(auth(token))).status, 403)
    }
    assert.equal((await request(app).get('/api/admin/dashboard')).status, 401)
  })

  it('returns platform KPIs and redacts credentials', async () => {
    const dashboard = await request(app).get('/api/admin/dashboard').set(auth(adminToken))
    assert.equal(dashboard.status, 200)
    assert.equal(dashboard.body.users.total >= 5, true)
    assert.equal(typeof dashboard.body.confirmedRevenue, 'string')
    assert.equal(JSON.stringify(dashboard.body).includes('password_hash'), false)
    const users = await request(app).get('/api/admin/users?search=phase10-attendee&role=attendee').set(auth(adminToken))
    assert.equal(users.status, 200)
    assert.equal(users.body.data.length, 1)
    assert.equal('password_hash' in users.body.data[0], false)
  })
})

describe('admin role and moderation controls', () => {
  it('changes attendee and organizer roles but protects administrators', async () => {
    const promoted = await request(app).patch(`/api/admin/users/${attendeeId}/role`).set(auth(adminToken)).send({ role: 'organizer' })
    assert.equal(promoted.status, 200)
    assert.equal(promoted.body.role, 'organizer')
    const demoted = await request(app).patch(`/api/admin/users/${otherOrganizerId}/role`).set(auth(adminToken)).send({ role: 'attendee' })
    assert.equal(demoted.status, 200)
    assert.equal(demoted.body.role, 'attendee')
    const protectedAdmin = await request(app).patch(`/api/admin/users/${(await request(app).get('/api/auth/me').set(auth(secondAdminToken))).body.id}/role`).set(auth(adminToken)).send({ role: 'attendee' })
    assert.equal(protectedAdmin.status, 422)
    const selfEscalation = await request(app).patch(`/api/admin/users/${attendeeId}/role`).set(auth(attendeeToken)).send({ role: 'admin' })
    assert.equal(selfEscalation.status, 403)
  })

  it('prevents removing the final administrator and preserves event transitions', async () => {
    const secondAdminId = (await request(app).get('/api/auth/me').set(auth(secondAdminToken))).body.id as string
    await pool.query('DELETE FROM users WHERE id = $1', [secondAdminId])
    const finalAdminId = (await request(app).get('/api/auth/me').set(auth(adminToken))).body.id as string
    const finalAdmin = await request(app).patch(`/api/admin/users/${finalAdminId}/role`).set(auth(adminToken)).send({ role: 'attendee' })
    assert.equal(finalAdmin.status, 422)
    const published = await request(app).patch(`/api/admin/events/${eventId}/status`).set(auth(adminToken)).send({ status: 'published' })
    assert.equal(published.status, 200)
    const invalid = await request(app).patch(`/api/admin/events/${eventId}/status`).set(auth(adminToken)).send({ status: 'draft' })
    assert.equal(invalid.status, 400)
    const cancelled = await request(app).patch(`/api/admin/events/${eventId}/status`).set(auth(adminToken)).send({ status: 'cancelled' })
    assert.equal(cancelled.status, 200)
  })
})

describe('admin monitoring and audit logs', () => {
  it('lists orders, tickets, and audit records without QR tokens', async () => {
    const replacement = await request(app).post('/api/events').set(auth(organizerToken)).send({ title: 'Phase Ten Monitoring Event', start_at: '2036-02-01T10:00:00Z', end_at: '2036-02-01T12:00:00Z' })
    const replacementId = replacement.body.event.id as string
    await request(app).patch(`/api/events/${replacementId}`).set(auth(organizerToken)).send({ status: 'published' })
    const replacementType = await request(app).post(`/api/events/${replacementId}/ticket-types`).set(auth(organizerToken)).send({ name: 'General', price: 30, quantity: 3, sales_start_at: '2020-01-01T00:00:00Z', sales_end_at: '2099-01-01T00:00:00Z' })
    const order = await request(app).post('/api/orders').set(auth(attendeeToken)).send({ items: [{ ticketTypeId: replacementType.body.ticketType.id, quantity: 1 }] })
    assert.equal(order.status, 201)
    const orders = await request(app).get('/api/admin/orders?search=EVT-').set(auth(adminToken))
    assert.equal(orders.status, 200)
    assert.equal('provider_order_id' in (orders.body.data[0] ?? {}), true)
    const tickets = await request(app).get('/api/admin/tickets').set(auth(adminToken))
    assert.equal(tickets.status, 200)
    assert.equal(tickets.body.data.some((ticket: { qr_token?: string }) => 'qr_token' in ticket), false)
    const logs = await request(app).get('/api/admin/audit-logs?action=ROLE_CHANGED').set(auth(adminToken))
    assert.equal(logs.status, 200)
    assert.equal(logs.body.data.some((log: { action: string }) => log.action === 'ROLE_CHANGED'), true)
    assert.equal(logs.body.pagination.page, 1)
  })
})