import { randomBytes } from 'node:crypto'
import type { AuthenticatedUser } from '../types/request'
import type { OrderView } from '../types/order'
import pool from '../config/database'
import { AppError } from '../utils/errors'
import { findOrderById, findOrderItems, insertTicket, lockOrder } from '../repositories/order.repository'
import { createRazorpayOrder, getRazorpayPayment, verifyPaymentSignature } from './razorpay.service'
import { enqueueNotification } from './notification.service'

interface LockedPaymentOrder {
  id: string
  user_id: string
  status: string
  payment_status: string
  total_amount: string
  currency: string
}

export interface PaymentInitialization {
  orderId: string
  razorpayOrderId: string
  amount: number
  currency: string
  keyId: string
}

export async function initializePayment(user: AuthenticatedUser, orderId: string): Promise<PaymentInitialization> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const order = await getLockedPaymentOrder(client, orderId)
    assertOwner(user, order)
    assertPayable(order)

    const existing = await client.query<{ provider_order_id: string; amount: string; currency: string; status: string }>(
      'SELECT provider_order_id, amount, currency, status FROM payments WHERE order_id = $1 FOR UPDATE',
      [orderId],
    )
    if (existing.rows[0]?.status === 'pending') {
      await client.query('COMMIT')
      const { keyId } = getPublicRazorpayKey()
      return { orderId, razorpayOrderId: existing.rows[0].provider_order_id, amount: toMinorUnits(existing.rows[0].amount), currency: existing.rows[0].currency.trim(), keyId }
    }

    const amount = toMinorUnits(order.total_amount)
    const remoteOrder = await createRazorpayOrder(amount, order.currency.trim(), order.id)
    if (existing.rows[0]) {
      await client.query("UPDATE payments SET provider_order_id = $2, provider_payment_id = NULL, amount = $3, currency = $4, status = 'pending', failure_code = NULL, failure_description = NULL, updated_at = NOW() WHERE order_id = $1", [order.id, remoteOrder.id, order.total_amount, order.currency.trim()])
      await client.query("UPDATE orders SET payment_status = 'pending', updated_at = NOW() WHERE id = $1", [order.id])
    } else {
      await client.query(
        `INSERT INTO payments (order_id, provider, provider_order_id, amount, currency, status)
         VALUES ($1, 'razorpay', $2, $3, $4, 'pending')`,
        [order.id, remoteOrder.id, order.total_amount, order.currency.trim()],
      )
    }
    await client.query('COMMIT')
    const { keyId } = getPublicRazorpayKey()
    return { orderId, razorpayOrderId: remoteOrder.id, amount, currency: order.currency.trim(), keyId }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function verifyPayment(user: AuthenticatedUser, input: { orderId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }): Promise<OrderView> {
  if (!verifyPaymentSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature)) {
    throw new AppError(400, 'INVALID_PAYMENT_SIGNATURE', 'Payment signature is invalid')
  }
  const remotePayment = await getRazorpayPayment(input.razorpayPaymentId)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const order = await getLockedPaymentOrder(client, input.orderId)
    assertOwner(user, order)
    const payment = await findPayment(client, input.orderId)
    if (!payment || payment.provider_order_id !== input.razorpayOrderId) throw new AppError(400, 'PAYMENT_ORDER_MISMATCH', 'Payment order does not match the Eventora order')
    assertTrustedPaymentAmount(remotePayment, payment.amount, payment.currency, input.razorpayOrderId)
    if (remotePayment.id !== input.razorpayPaymentId || remotePayment.status !== 'captured') throw new AppError(422, 'PAYMENT_NOT_CAPTURED', 'Payment has not been captured')
    await confirmPaymentLocked(client, order, payment, remotePayment)
    await client.query('COMMIT')
    return (await findOrderById(input.orderId))!
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function processWebhookPayment(input: { eventType: string; providerEventId: string; payload: Record<string, unknown> }): Promise<void> {
  const paymentEntity = getPaymentEntity(input.payload)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const event = await client.query<{ id: string }>(
      `INSERT INTO payment_webhook_events (provider, provider_event_id, event_type, payload)
       VALUES ('razorpay', $1, $2, $3) ON CONFLICT (provider, provider_event_id) DO NOTHING RETURNING id`,
      [input.providerEventId, input.eventType, JSON.stringify(input.payload)],
    )
    if (!event.rows[0]) {
      await client.query('COMMIT')
      return
    }
    if (!paymentEntity?.order_id || !paymentEntity.id) {
      await markWebhookProcessed(client, event.rows[0].id)
      await client.query('COMMIT')
      return
    }
    const payment = await findPaymentByProviderOrder(client, paymentEntity.order_id)
    if (!payment) {
      await markWebhookProcessed(client, event.rows[0].id)
      await client.query('COMMIT')
      return
    }
    const order = await getLockedPaymentOrder(client, payment.order_id)
    if (input.eventType === 'payment.failed') {
      if (order.status === 'pending' && order.payment_status === 'pending') {
        await client.query("UPDATE payments SET provider_payment_id = $2, status = 'failed', method = $3, failure_code = $4, failure_description = $5, updated_at = NOW() WHERE id = $1", [payment.id, paymentEntity.id, paymentEntity.method ?? null, paymentEntity.error_code ?? null, paymentEntity.error_description ?? null])
        await client.query("UPDATE orders SET payment_status = 'failed', updated_at = NOW() WHERE id = $1", [order.id])
        await enqueueNotification(client, {
          userId: order.user_id,
          type: 'payment.failed',
          title: 'Payment failed',
          body: 'Your payment failed. You can retry payment from the existing order.',
          data: { orderId: order.id },
          dedupeKey: `payment.failed:${order.id}:${paymentEntity.id}`,
        })
      }
    } else if (input.eventType === 'payment.captured') {
      assertTrustedPaymentAmount(paymentEntity, payment.amount, payment.currency, paymentEntity.order_id)
      await confirmPaymentLocked(client, order, payment, paymentEntity)
    }
    await markWebhookProcessed(client, event.rows[0].id)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function getPublicRazorpayKey(): { keyId: string } {
  const keyId = process.env.RAZORPAY_KEY_ID
  if (!keyId) throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Payments are not configured')
  return { keyId }
}

async function getLockedPaymentOrder(client: import('pg').PoolClient, orderId: string): Promise<LockedPaymentOrder> {
  const result = await client.query<LockedPaymentOrder>('SELECT id, user_id, status, payment_status, total_amount, currency FROM orders WHERE id = $1 FOR UPDATE', [orderId])
  if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Order not found')
  return result.rows[0]
}

function assertOwner(user: AuthenticatedUser, order: LockedPaymentOrder): void {
  if (user.role !== 'admin' && order.user_id !== user.id) throw new AppError(403, 'FORBIDDEN', 'You cannot pay for this order')
}

function assertPayable(order: LockedPaymentOrder): void {
  if (order.status !== 'pending' || !['pending', 'failed'].includes(order.payment_status)) throw new AppError(422, 'ORDER_NOT_PAYABLE', 'Order is not awaiting payment')
}

function toMinorUnits(amount: string): number {
  const [whole, fraction = ''] = amount.split('.')
  const minorUnits = Number(`${whole}${fraction.padEnd(2, '0').slice(0, 2)}`)
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) throw new AppError(422, 'INVALID_ORDER_AMOUNT', 'Order amount cannot be processed')
  return minorUnits
}

async function findPayment(client: import('pg').PoolClient, orderId: string): Promise<PaymentRow | null> {
  const result = await client.query<PaymentRow>('SELECT id, order_id, provider_order_id, provider_payment_id, amount, currency, status FROM payments WHERE order_id = $1 FOR UPDATE', [orderId])
  return result.rows[0] ?? null
}

async function findPaymentByProviderOrder(client: import('pg').PoolClient, providerOrderId: string): Promise<PaymentRow | null> {
  const result = await client.query<PaymentRow>('SELECT id, order_id, provider_order_id, provider_payment_id, amount, currency, status FROM payments WHERE provider_order_id = $1 FOR UPDATE', [providerOrderId])
  return result.rows[0] ?? null
}

interface PaymentRow {
  id: string
  order_id: string
  provider_order_id: string
  provider_payment_id: string | null
  amount: string
  currency: string
  status: string
}

interface PaymentEntity {
  id: string
  order_id: string
  amount: number
  currency: string
  status?: string
  method?: string
  error_code?: string
  error_description?: string
}

function getPaymentEntity(payload: Record<string, unknown>): PaymentEntity | null {
  const payloadData = payload.payload as Record<string, unknown> | undefined
  const payment = payloadData?.payment as Record<string, unknown> | undefined
  const entity = payment?.entity as Record<string, unknown> | undefined
  if (typeof entity?.id !== 'string' || typeof entity.order_id !== 'string' || typeof entity.amount !== 'number' || typeof entity.currency !== 'string') return null
  return entity as unknown as PaymentEntity
}

function assertTrustedPaymentAmount(payment: { amount: number; currency: string; order_id: string }, expectedAmount: string, expectedCurrency: string, expectedOrderId: string): void {
  if (payment.order_id !== expectedOrderId || payment.amount !== toMinorUnits(expectedAmount) || payment.currency !== expectedCurrency.trim()) throw new AppError(400, 'PAYMENT_AMOUNT_MISMATCH', 'Payment amount or currency does not match the order')
}

async function confirmPaymentLocked(client: import('pg').PoolClient, order: LockedPaymentOrder, payment: PaymentRow, remotePayment: { id: string; amount: number; currency: string; method?: string }): Promise<void> {
  if (order.status === 'confirmed' && order.payment_status === 'paid') return
  if (order.status !== 'pending' || order.payment_status !== 'pending') throw new AppError(422, 'ORDER_NOT_CONFIRMABLE', 'Order is not awaiting payment')
  await client.query("UPDATE payments SET provider_payment_id = $2, status = 'captured', method = $3, captured_at = NOW(), updated_at = NOW() WHERE id = $1", [payment.id, remotePayment.id, remotePayment.method ?? null])
  await client.query("UPDATE orders SET payment_status = 'paid', status = 'confirmed', updated_at = NOW() WHERE id = $1", [order.id])
  const items = await findOrderItems(client, order.id)
  for (const item of items) {
    const countResult = await client.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM tickets WHERE order_item_id = $1', [item.id])
    const missing = item.quantity - Number(countResult.rows[0].count)
    if (missing < 0) throw new AppError(409, 'TICKET_INTEGRITY_ERROR', 'Order already has too many tickets')
    for (let index = 0; index < missing; index += 1) {
      await insertTicket(client, { orderItemId: item.id, ticketTypeId: item.ticket_type_id, userId: order.user_id, ticketNumber: `EVT-${randomBytes(7).toString('hex').toUpperCase()}`, qrToken: randomBytes(32).toString('base64url') })
    }
  }
  await enqueueNotification(client, {
    userId: order.user_id,
    type: 'payment.captured',
    title: 'Payment confirmed',
    body: 'Payment was captured and your tickets are ready.',
    data: { orderId: order.id },
    dedupeKey: `payment.captured:${order.id}:${remotePayment.id}`,
  })
}

async function markWebhookProcessed(client: import('pg').PoolClient, eventId: string): Promise<void> {
  await client.query('UPDATE payment_webhook_events SET processed_at = NOW() WHERE id = $1', [eventId])
}