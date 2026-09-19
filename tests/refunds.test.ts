import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool } from 'pg'

process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev'
process.env.JWT_SECRET ??= 'phase12-refund-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN ??= '1h'
process.env.RAZORPAY_KEY_ID = 'rzp_test_phase12'
process.env.RAZORPAY_KEY_SECRET = 'phase12-test-provider-secret'
process.env.RAZORPAY_WEBHOOK_SECRET = 'phase12-test-webhook-secret'

let app: Express
let pool: Pool
let attendeeToken = ''
let organizerToken = ''
let adminToken = ''
let ticketTypeId = ''
let providerShouldFail = false
let refundProviderCalls = 0

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
  if (String(input).includes('/refund')) {
    refundProviderCalls += 1
    if (providerShouldFail) return new Response(JSON.stringify({ error: 'failure' }), { status: 502 })
    const paymentId = String(input).split('/payments/')[1]?.split('/')[0] ?? 'pay_phase12'
    return new Response(JSON.stringify({ id: `rfnd_phase12_${refundProviderCalls}`, payment_id: paymentId, amount: 3000, currency: 'USD', status: 'processed' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

async function register(email: string, role?: 'organizer' | 'admin'): Promise<{ token: string; id: string }> {
  const password = 'phase12-strong-password'
  const created = await request(app).post('/api/auth/register').send({ name: email.split('@')[0], email, password })
  assert.equal(created.status, 201)
  const id = created.body.user.id as string
  if (role) await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id])
  const loggedIn = await request(app).post('/api/auth/login').send({ email, password })
  assert.equal(loggedIn.status, 200)
  return { token: loggedIn.body.accessToken, id }
}

async function createPaidOrder(): Promise<{ orderId: string; ticketId: string; qrToken: string }> {
  const created = await request(app).post('/api/orders').set(auth(attendeeToken)).send({ items: [{ ticketTypeId, quantity: 1 }] })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const { confirmOrderForDevelopment } = await import('../server/src/services/order.service')
  await confirmOrderForDevelopment(created.body.order.id)
  const row = await pool.query<{ id: string; qr_token: string }>('SELECT id, qr_token FROM tickets WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)', [created.body.order.id])
  await pool.query("INSERT INTO payments (order_id, provider, provider_order_id, provider_payment_id, amount, currency, status) VALUES ($1, 'razorpay', $2, $3, 30, 'USD', 'captured')", [created.body.order.id, `order_phase12_${created.body.order.id}`, `pay_phase12_${created.body.order.id}`])
  return { orderId: created.body.order.id, ticketId: row.rows[0].id, qrToken: row.rows[0].qr_token }
}

async function cleanup(): Promise<void> {
  await pool.query("DELETE FROM audit_logs WHERE entity_type = 'refund' AND (actor_user_id IN (SELECT id FROM users WHERE email LIKE 'phase12-%@example.test') OR admin_user_id IN (SELECT id FROM users WHERE email LIKE 'phase12-%@example.test'))")
  await pool.query("DELETE FROM refunds WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase12-%@example.test'))")
  await pool.query("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase12-%@example.test')")
  await pool.query("DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase12-%@example.test'))")
  await pool.query("DELETE FROM tickets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase12-%@example.test')")
  await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase12-%@example.test'))")
  await pool.query("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase12-%@example.test')")
  await pool.query("DELETE FROM ticket_types WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase12-%@example.test'))")
  await pool.query("DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase12-%@example.test')")
  await pool.query("DELETE FROM users WHERE email LIKE 'phase12-%@example.test'")
}

before(async () => {
  ;({ default: app } = await import('../server/src/app'))
  ;({ default: pool } = await import('../server/src/config/database'))
  await cleanup()
  attendeeToken = (await register('phase12-attendee@example.test')).token
  organizerToken = (await register('phase12-organizer@example.test', 'organizer')).token
  adminToken = (await register('phase12-admin@example.test', 'admin')).token
  const event = await request(app).post('/api/events').set(auth(organizerToken)).send({ title: 'Phase Twelve Refunds', start_at: '2040-01-01T10:00:00Z', end_at: '2040-01-01T12:00:00Z' })
  assert.equal(event.status, 201)
  await request(app).patch(`/api/events/${event.body.event.id}`).set(auth(organizerToken)).send({ status: 'published' })
  const type = await request(app).post(`/api/events/${event.body.event.id}/ticket-types`).set(auth(organizerToken)).send({ name: 'Refundable', price: 30, quantity: 20, sales_start_at: '2020-01-01T00:00:00Z', sales_end_at: '2099-01-01T00:00:00Z' })
  assert.equal(type.status, 201)
  ticketTypeId = type.body.ticketType.id
})

after(async () => { globalThis.fetch = originalFetch; await cleanup(); await pool.end() })

describe('refund workflows', () => {
  it('rejects malformed refund input and missing idempotency references', async () => {
    const paid = await createPaidOrder()
    const malformed = await request(app).post(`/api/orders/${paid.orderId}/refund`).set(auth(attendeeToken)).send({ amount: 'thirty' })
    const missingKey = await request(app).post(`/api/orders/${paid.orderId}/refund`).set(auth(attendeeToken)).send({})
    assert.equal(malformed.status, 400)
    assert.equal(missingKey.status, 400)
  })

  it('processes a full refund, invalidates tickets, restores inventory, notifies, and audits', async () => {
    refundProviderCalls = 0
    const paid = await createPaidOrder()
    const before = await pool.query('SELECT quantity_sold FROM ticket_types WHERE id = $1', [ticketTypeId])
    const response = await request(app).post(`/api/orders/${paid.orderId}/refund`).set(auth(attendeeToken)).set('Idempotency-Key', 'refund-success-1').send({ reason: 'Changed plans' })
    assert.equal(response.status, 201, JSON.stringify(response.body))
    assert.equal(response.body.refund.status, 'processed')
    assert.equal(refundProviderCalls, 1)
    const order = await request(app).get(`/api/orders/${paid.orderId}`).set(auth(attendeeToken))
    assert.equal(order.body.status, 'refunded')
    assert.equal(order.body.payment_status, 'refunded')
    const ticket = await pool.query('SELECT status FROM tickets WHERE id = $1', [paid.ticketId])
    const payment = await pool.query('SELECT status FROM payments WHERE order_id = $1', [paid.orderId])
    const inventory = await pool.query('SELECT quantity_sold FROM ticket_types WHERE id = $1', [ticketTypeId])
    const notification = await pool.query("SELECT type FROM notifications WHERE user_id = (SELECT user_id FROM orders WHERE id = $1) AND type = 'refund.processed'", [paid.orderId])
    const audit = await pool.query("SELECT action, actor_user_id FROM audit_logs WHERE entity_type = 'refund' AND entity_id = $1", [response.body.refund.id])
    assert.equal(ticket.rows[0].status, 'cancelled')
    assert.equal(payment.rows[0].status, 'refunded')
    assert.equal(Number(inventory.rows[0].quantity_sold), Number(before.rows[0].quantity_sold) - 1)
    assert.equal(notification.rows.length, 1)
    assert.equal(audit.rows[0].action, 'REFUND_PROCESSED')
    assert.equal(audit.rows[0].actor_user_id !== null, true)
  })

  it('is idempotent for repeated and concurrent references', async () => {
    const paid = await createPaidOrder()
    const requests = await Promise.all([1, 2].map(() => request(app).post(`/api/orders/${paid.orderId}/refund`).set(auth(attendeeToken)).set('Idempotency-Key', 'refund-concurrent').send({})))
    assert.equal(requests.every((item) => item.status === 201), true)
    assert.equal(new Set(requests.map((item) => item.body.refund.id)).size, 1)
    assert.equal(refundProviderCalls >= 1, true)
    const refunds = await request(app).get(`/api/orders/${paid.orderId}/refunds`).set(auth(attendeeToken))
    assert.equal(refunds.body.data.length, 1)
  })

  it('enforces authorization, payment state, amount, and checked-in policy', async () => {
    const paid = await createPaidOrder()
    assert.equal((await request(app).post(`/api/orders/${paid.orderId}/refund`).set(auth(organizerToken)).set('Idempotency-Key', 'organizer-denied').send({})).status, 403)
    assert.equal((await request(app).post(`/api/orders/${paid.orderId}/refund`).set(auth(attendeeToken)).set('Idempotency-Key', 'too-much').send({ amount: 31 })).status, 422)
    const { checkInTicket } = await import('../server/src/services/ticket.service')
    const organizer = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', ['phase12-organizer@example.test'])
    await checkInTicket({ id: organizer.rows[0].id, role: 'organizer' }, paid.qrToken)
    assert.equal((await request(app).post(`/api/orders/${paid.orderId}/refund`).set(auth(attendeeToken)).set('Idempotency-Key', 'checked-in').send({})).status, 422)
  })

  it('rejects unpaid orders, supports admin refunds, and reports provider failure', async () => {
    const unpaid = await request(app).post('/api/orders').set(auth(attendeeToken)).send({ items: [{ ticketTypeId, quantity: 1 }] })
    assert.equal((await request(app).post(`/api/orders/${unpaid.body.order.id}/refund`).set(auth(attendeeToken)).set('Idempotency-Key', 'unpaid').send({})).status, 422)
    const paid = await createPaidOrder()
    assert.equal((await request(app).post(`/api/orders/${paid.orderId}/refund`).set(auth(adminToken)).set('Idempotency-Key', 'admin-refund').send({})).status, 201)
    const failed = await createPaidOrder()
    providerShouldFail = true
    const failure = await request(app).post(`/api/orders/${failed.orderId}/refund`).set(auth(attendeeToken)).set('Idempotency-Key', 'provider-failure').send({})
    providerShouldFail = false
    assert.equal(failure.status, 502)
    const failedRow = await pool.query("SELECT status FROM refunds WHERE order_id = $1", [failed.orderId])
    assert.equal(failedRow.rows[0].status, 'failed')
  })
})