import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool } from 'pg'

process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev'
process.env.JWT_SECRET ??= 'phase6-test-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN ??= '1h'
process.env.RAZORPAY_KEY_ID = 'rzp_test_phase6'
process.env.RAZORPAY_KEY_SECRET = 'phase6-razorpay-key-secret'
process.env.RAZORPAY_WEBHOOK_SECRET = 'phase6-razorpay-webhook-secret'

let app: Express
let pool: Pool
let buyerToken = ''
let secondBuyerToken = ''
let ticketTypeId = ''
let ticketQuantity = 0

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })
let remotePaymentStatus = 'captured'
let remotePaymentId = 'pay_phase6'
let remoteOrderId = 'order_phase6'

const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, _init?: RequestInit): Promise<Response> => {
  const url = String(input)
  if (url.endsWith('/orders')) return new Response(JSON.stringify({ id: remoteOrderId }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  return new Response(JSON.stringify({ id: remotePaymentId, order_id: remoteOrderId, amount: 2500, currency: 'USD', status: remotePaymentStatus, method: 'card' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

async function registerAndLogin(email: string, role?: 'organizer'): Promise<string> {
  const password = 'phase6-strong-password'
  const registration = await request(app).post('/api/auth/register').send({ name: email, email, password })
  assert.equal(registration.status, 201)
  if (role) await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, registration.body.user.id])
  const login = await request(app).post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200)
  return login.body.accessToken as string
}

async function createOrder(token: string): Promise<{ id: string; total: string }> {
  const response = await request(app).post('/api/orders').set(auth(token)).send({ items: [{ ticketTypeId, quantity: 1 }] })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return { id: response.body.order.id as string, total: response.body.order.total_amount as string }
}

function paymentSignature(orderId: string): string {
  return createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update(`${remoteOrderId}|${remotePaymentId}`).digest('hex')
}

function webhookPayload(eventId: string, event = 'payment.captured'): Record<string, unknown> {
  return { id: eventId, event, payload: { payment: { entity: { id: remotePaymentId, order_id: remoteOrderId, amount: 2500, currency: 'USD', status: remotePaymentStatus, method: 'card' } } } }
}

async function cleanup(): Promise<void> {
  await pool.query("DELETE FROM payment_webhook_events WHERE provider = 'razorpay'")
  await pool.query("DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase6-%@example.test'))")
  await pool.query("DELETE FROM tickets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase6-%@example.test')")
  await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase6-%@example.test'))")
  await pool.query("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase6-%@example.test')")
  await pool.query("DELETE FROM ticket_types WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase6-%@example.test'))")
  await pool.query("DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase6-%@example.test')")
  await pool.query("DELETE FROM users WHERE email LIKE 'phase6-%@example.test'")
}

before(async () => {
  ;({ default: app } = await import('../server/src/app'))
  ;({ default: pool } = await import('../server/src/config/database'))
  await cleanup()
  const organizerToken = await registerAndLogin('phase6-organizer@example.test', 'organizer')
  buyerToken = await registerAndLogin('phase6-buyer@example.test')
  secondBuyerToken = await registerAndLogin('phase6-second@example.test')
  const event = await request(app).post('/api/events').set(auth(organizerToken)).send({ title: 'Phase Six Payments', start_at: '2032-01-01T10:00:00Z', end_at: '2032-01-01T12:00:00Z' })
  assert.equal(event.status, 201)
  await request(app).patch(`/api/events/${event.body.event.id}`).set(auth(organizerToken)).send({ status: 'published' })
  const ticket = await request(app).post(`/api/events/${event.body.event.id}/ticket-types`).set(auth(organizerToken)).send({ name: 'General', price: 25, quantity: 20, sales_start_at: '2020-01-01T00:00:00Z', sales_end_at: '2099-01-01T00:00:00Z' })
  ticketTypeId = ticket.body.ticketType.id
  ticketQuantity = ticket.body.ticketType.quantity
})

after(async () => {
  globalThis.fetch = originalFetch
  await cleanup()
  await pool.end()
})

describe('Razorpay payment integration', () => {
  it('rejects an invalid webhook signature', async () => {
    const response = await request(app).post('/api/payments/webhook').type('application/json').set('x-razorpay-signature', 'invalid').send(JSON.stringify(webhookPayload('evt_invalid')))
    assert.equal(response.status, 400)
  })

  it('initializes from the trusted order total and rejects unauthorized owners', async () => {
    const order = await createOrder(buyerToken)
    const initialized = await request(app).post(`/api/orders/${order.id}/payment`).set(auth(buyerToken)).send({ amount: 1, currency: 'INR' })
    assert.equal(initialized.status, 200)
    assert.equal(initialized.body.amount, 2500)
    assert.equal(initialized.body.currency, 'USD')
    const unauthorized = await request(app).post(`/api/orders/${order.id}/payment`).set(auth(secondBuyerToken))
    assert.equal(unauthorized.status, 403)
  })

  it('rejects invalid signatures and mismatched provider orders', async () => {
    const order = await createOrder(buyerToken)
    remoteOrderId = `order_${order.id}`
    await request(app).post(`/api/orders/${order.id}/payment`).set(auth(buyerToken))
    const invalid = await request(app).post('/api/payments/verify').set(auth(buyerToken)).send({ orderId: order.id, razorpayOrderId: remoteOrderId, razorpayPaymentId: remotePaymentId, razorpaySignature: 'bad' })
    assert.equal(invalid.status, 400)
    const mismatch = await request(app).post('/api/payments/verify').set(auth(buyerToken)).send({ orderId: order.id, razorpayOrderId: 'order_wrong', razorpayPaymentId: remotePaymentId, razorpaySignature: paymentSignature(order.id) })
    assert.equal(mismatch.status, 400)
  })

  it('confirms through verification and does not duplicate on the same webhook', async () => {
    const order = await createOrder(buyerToken)
    remoteOrderId = `order_${order.id}`
    remotePaymentId = `pay_${order.id}`
    await request(app).post(`/api/orders/${order.id}/payment`).set(auth(buyerToken))
    const verified = await request(app).post('/api/payments/verify').set(auth(buyerToken)).send({ orderId: order.id, razorpayOrderId: remoteOrderId, razorpayPaymentId: remotePaymentId, razorpaySignature: paymentSignature(order.id) })
    assert.equal(verified.status, 200)
    assert.equal(verified.body.order.status, 'confirmed')
    const notification = await pool.query<{ type: string }>(
      "SELECT type FROM notifications WHERE user_id = (SELECT user_id FROM orders WHERE id = $1) AND type = 'payment.captured'",
      [order.id],
    )
    assert.equal(notification.rows.length, 1)
    const raw = JSON.stringify(webhookPayload(`evt_${order.id}`))
    const first = await request(app).post('/api/payments/webhook').type('application/json').set('x-razorpay-signature', createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest('hex')).send(raw)
    const second = await request(app).post('/api/payments/webhook').type('application/json').set('x-razorpay-signature', createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest('hex')).send(raw)
    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    const tickets = await pool.query('SELECT id FROM tickets WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)', [order.id])
    assert.equal(tickets.rows.length, 1)
  })

  it('handles a failed payment without issuing tickets and rejects cancelled orders', async () => {
    const order = await createOrder(buyerToken)
    remoteOrderId = `order_${order.id}`
    remotePaymentId = `pay_${order.id}`
    await request(app).post(`/api/orders/${order.id}/payment`).set(auth(buyerToken))
    remotePaymentStatus = 'failed'
    const payload = webhookPayload(`evt_failed_${order.id}`, 'payment.failed')
    const raw = JSON.stringify(payload)
    const response = await request(app).post('/api/payments/webhook').type('application/json').set('x-razorpay-signature', createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest('hex')).send(raw)
    assert.equal(response.status, 200)
    const orderAfter = await request(app).get(`/api/orders/${order.id}`).set(auth(buyerToken))
    assert.equal(orderAfter.body.payment_status, 'failed')
    const tickets = await pool.query('SELECT id FROM tickets WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)', [order.id])
    assert.equal(tickets.rows.length, 0)
    remotePaymentStatus = 'captured'
    remoteOrderId = `order_retry_${order.id}`
    const retry = await request(app).post(`/api/orders/${order.id}/payment`).set(auth(buyerToken))
    assert.equal(retry.status, 200)
    assert.equal(retry.body.razorpayOrderId, remoteOrderId)
    const cancelled = await createOrder(buyerToken)
    await request(app).post(`/api/orders/${cancelled.id}/cancel`).set(auth(buyerToken))
    const rejected = await request(app).post(`/api/orders/${cancelled.id}/payment`).set(auth(buyerToken))
    assert.equal(rejected.status, 422)
  })

  it('keeps verification and webhook confirmation idempotent when they race', async () => {
    const order = await createOrder(buyerToken)
    remoteOrderId = `order_${order.id}`
    remotePaymentId = `pay_${order.id}`
    await request(app).post(`/api/orders/${order.id}/payment`).set(auth(buyerToken))
    const raw = JSON.stringify(webhookPayload(`evt_race_${order.id}`))
    const signature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest('hex')
    const [verified, webhook] = await Promise.all([
      request(app).post('/api/payments/verify').set(auth(buyerToken)).send({ orderId: order.id, razorpayOrderId: remoteOrderId, razorpayPaymentId: remotePaymentId, razorpaySignature: paymentSignature(order.id) }),
      request(app).post('/api/payments/webhook').type('application/json').set('x-razorpay-signature', signature).send(raw),
    ])
    assert.equal(verified.status, 200)
    assert.equal(webhook.status, 200)
    const tickets = await pool.query('SELECT id FROM tickets WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1)', [order.id])
    assert.equal(tickets.rows.length, 1)
    const inventory = await pool.query('SELECT quantity_sold FROM ticket_types WHERE id = $1', [ticketTypeId])
    assert.equal(Number(inventory.rows[0].quantity_sold) >= 5, true)
    assert.equal(ticketQuantity, 20)
  })
})