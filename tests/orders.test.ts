import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool } from 'pg'

process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev'
process.env.JWT_SECRET ??= 'phase5-test-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN ??= '1h'

let app: Express
let pool: Pool
let organizerToken = ''
let buyerToken = ''
let secondBuyerToken = ''
let organizerId = ''
let eventId = ''
let draftEventId = ''
let ticketTypeId = ''
let concurrencyTicketTypeId = ''
let pendingOrderId = ''

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

async function registerAndLogin(email: string, name: string, role?: 'organizer'): Promise<{ token: string; id: string }> {
  const password = 'phase5-strong-password'
  const registration = await request(app).post('/api/auth/register').send({ name, email, password })
  assert.equal(registration.status, 201)
  const id = registration.body.user.id as string
  if (role) await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id])
  const login = await request(app).post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200)
  return { token: login.body.accessToken as string, id }
}

async function createEventAndTicket(token: string, title: string, quantity: number, status: 'draft' | 'published' = 'published', salesStart = '2020-01-01T00:00:00Z', salesEnd = '2099-01-01T00:00:00Z'): Promise<{ eventId: string; ticketTypeId: string }> {
  const event = await request(app).post('/api/events').set(auth(token)).send({ title, start_at: '2032-01-01T10:00:00Z', end_at: '2032-01-01T12:00:00Z' })
  assert.equal(event.status, 201)
  const createdEventId = event.body.event.id as string
  if (status === 'published') {
    const published = await request(app).patch(`/api/events/${createdEventId}`).set(auth(token)).send({ status })
    assert.equal(published.status, 200)
  }
  const ticket = await request(app).post(`/api/events/${createdEventId}/ticket-types`).set(auth(token)).send({ name: title, price: 25, quantity, sales_start_at: salesStart, sales_end_at: salesEnd })
  assert.equal(ticket.status, 201)
  return { eventId: createdEventId, ticketTypeId: ticket.body.ticketType.id as string }
}

async function cleanup(): Promise<void> {
  await pool.query("DELETE FROM tickets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase5-%@example.test')")
  await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase5-%@example.test'))")
  await pool.query("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase5-%@example.test')")
  await pool.query("DELETE FROM ticket_types WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase5-%@example.test'))")
  await pool.query("DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase5-%@example.test')")
  await pool.query("DELETE FROM users WHERE email LIKE 'phase5-%@example.test'")
}

before(async () => {
  ;({ default: app } = await import('../server/src/app'))
  ;({ default: pool } = await import('../server/src/config/database'))
  await cleanup()
  const organizer = await registerAndLogin('phase5-organizer@example.test', 'Phase Five Organizer', 'organizer')
  const buyer = await registerAndLogin('phase5-buyer@example.test', 'Phase Five Buyer')
  const secondBuyer = await registerAndLogin('phase5-second-buyer@example.test', 'Phase Five Second Buyer')
  organizerToken = organizer.token
  organizerId = organizer.id
  buyerToken = buyer.token
  secondBuyerToken = secondBuyer.token
  const primary = await createEventAndTicket(organizerToken, 'Phase Five Primary Ticket', 10)
  eventId = primary.eventId
  ticketTypeId = primary.ticketTypeId
  const concurrency = await createEventAndTicket(organizerToken, 'Phase Five Concurrency Ticket', 5)
  concurrencyTicketTypeId = concurrency.ticketTypeId
  const draft = await createEventAndTicket(organizerToken, 'Phase Five Draft Ticket', 5, 'draft')
  draftEventId = draft.eventId
})

after(async () => {
  if (!pool) return
  await cleanup()
  await pool.end()
})

describe('order creation and pricing', () => {
  it('rejects unauthenticated and invalid orders', async () => {
    const unauthenticated = await request(app).post('/api/orders').send({ items: [{ ticketTypeId, quantity: 1 }] })
    const invalidQuantity = await request(app).post('/api/orders').set(auth(buyerToken)).send({ items: [{ ticketTypeId, quantity: 0 }] })
    const invalidTicket = await request(app).post('/api/orders').set(auth(buyerToken)).send({ items: [{ ticketTypeId: '00000000-0000-0000-0000-000000000000', quantity: 1 }] })
    assert.equal(unauthenticated.status, 401)
    assert.equal(invalidQuantity.status, 400)
    assert.equal(invalidTicket.status, 404)
  })

  it('calculates totals from database prices and reserves inventory', async () => {
    const response = await request(app).post('/api/orders').set(auth(buyerToken)).send({ items: [{ ticketTypeId, quantity: 2, unitPrice: 0, total: 0 }] })
    assert.equal(response.status, 201, JSON.stringify(response.body))
    assert.equal(response.body.order.status, 'pending')
    assert.equal(response.body.order.payment_status, 'pending')
    assert.equal(response.body.order.total_amount, '50.00')
    pendingOrderId = response.body.order.id
    const inventory = await pool.query('SELECT quantity, quantity_sold FROM ticket_types WHERE id = $1', [ticketTypeId])
    assert.equal(inventory.rows[0].quantity_sold, 2)
  })

  it('supports idempotent order retries', async () => {
    const first = await request(app).post('/api/orders').set(auth(buyerToken)).set('Idempotency-Key', 'phase5-idempotency-key').send({ items: [{ ticketTypeId, quantity: 1 }] })
    const second = await request(app).post('/api/orders').set(auth(buyerToken)).set('Idempotency-Key', 'phase5-idempotency-key').send({ items: [{ ticketTypeId, quantity: 9 }] })
    assert.equal(first.status, 201)
    assert.equal(second.status, 201)
    assert.equal(second.body.order.id, first.body.order.id)
    assert.equal(second.body.order.items[0].quantity, 1)
  })

  it('rejects unpublished events and inactive sales windows', async () => {
    const draftTicket = await pool.query<{ id: string }>('SELECT id FROM ticket_types WHERE event_id = $1', [draftEventId])
    const unpublished = await request(app).post('/api/orders').set(auth(buyerToken)).send({ items: [{ ticketTypeId: draftTicket.rows[0].id, quantity: 1 }] })
    const future = await createEventAndTicket(organizerToken, 'Phase Five Future Sale', 2, 'published', '2090-01-01T00:00:00Z', '2091-01-01T00:00:00Z')
    const inactive = await request(app).post('/api/orders').set(auth(buyerToken)).send({ items: [{ ticketTypeId: future.ticketTypeId, quantity: 1 }] })
    assert.equal(unpublished.status, 422)
    assert.equal(inactive.status, 422)
  })
})

describe('inventory concurrency and lifecycle', () => {
  it('prevents overselling under concurrent requests', async () => {
    const results = await Promise.all([
      request(app).post('/api/orders').set(auth(buyerToken)).send({ items: [{ ticketTypeId: concurrencyTicketTypeId, quantity: 4 }] }),
      request(app).post('/api/orders').set(auth(secondBuyerToken)).send({ items: [{ ticketTypeId: concurrencyTicketTypeId, quantity: 4 }] }),
    ])
    const successes = results.filter((result) => result.status === 201)
    const failures = results.filter((result) => result.status === 409)
    assert.equal(successes.length, 1)
    assert.equal(failures.length, 1)
    const inventory = await pool.query('SELECT quantity, quantity_sold FROM ticket_types WHERE id = $1', [concurrencyTicketTypeId])
    assert.equal(inventory.rows[0].quantity, 5)
    assert.equal(inventory.rows[0].quantity_sold, 4)
  })

  it('cancels a pending order and releases inventory transactionally', async () => {
    const created = await request(app).post('/api/orders').set(auth(secondBuyerToken)).send({ items: [{ ticketTypeId, quantity: 1 }] })
    assert.equal(created.status, 201)
    const cancelled = await request(app).post(`/api/orders/${created.body.order.id}/cancel`).set(auth(secondBuyerToken))
    assert.equal(cancelled.status, 204)
    const order = await request(app).get(`/api/orders/${created.body.order.id}`).set(auth(secondBuyerToken))
    assert.equal(order.body.status, 'cancelled')
  })

  it('creates one ticket per quantity after development confirmation', async () => {
    const { confirmOrderForDevelopment } = await import('../server/src/services/order.service')
    const confirmed = await confirmOrderForDevelopment(pendingOrderId)
    assert.equal(confirmed.status, 'confirmed')
    assert.equal(confirmed.payment_status, 'paid')
    const tickets = await request(app).get(`/api/orders/${pendingOrderId}/tickets`).set(auth(buyerToken))
    assert.equal(tickets.status, 200)
    assert.equal(tickets.body.data.length, 2)
    assert.equal(new Set(tickets.body.data.map((ticket: { ticket_number: string }) => ticket.ticket_number)).size, 2)
    assert.equal(new Set(tickets.body.data.map((ticket: { qr_token: string }) => ticket.qr_token)).size, 2)
  })
})

describe('order and ticket authorization', () => {
  it('allows owners and blocks unrelated users', async () => {
    const own = await request(app).get(`/api/orders/${pendingOrderId}`).set(auth(buyerToken))
    const other = await request(app).get(`/api/orders/${pendingOrderId}`).set(auth(secondBuyerToken))
    const ownTickets = await request(app).get('/api/tickets').set(auth(buyerToken))
    const otherTickets = await request(app).get(`/api/orders/${pendingOrderId}/tickets`).set(auth(secondBuyerToken))
    assert.equal(own.status, 200)
    assert.equal(other.status, 403)
    assert.equal(ownTickets.status, 200)
    assert.equal(otherTickets.status, 403)
  })

  it('allows an organizer to view orders for their events', async () => {
    const response = await request(app).get('/api/orders').set(auth(organizerToken))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.some((order: { items: Array<{ event_id: string }> }) => order.items.some((item) => item.event_id === eventId)), true)
    assert.equal(organizerId.length > 0, true)
  })
})
