import type { PoolClient } from 'pg'
import pool from '../config/database'
import { AppError } from '../utils/errors'
import type { AuthenticatedUser } from '../types/request'
import { createRazorpayRefund } from './razorpay.service'
import { enqueueNotification } from './notification.service'

interface LockedOrder { id: string; user_id: string; status: string; payment_status: string; total_amount: string; currency: string }
interface PaymentRow { id: string; provider_payment_id: string | null; amount: string; currency: string; status: string }
export interface RefundView { id: string; order_id: string; payment_id: string; provider: string; provider_refund_id: string | null; amount: string; currency: string; status: string; reason: string | null; idempotency_key: string; created_at: string; updated_at: string }

export async function requestRefund(user: AuthenticatedUser, orderId: string, input: { amount?: number; reason?: string }, idempotencyKey: string): Promise<RefundView> {
  if (user.role !== 'admin' && user.role !== 'attendee') throw new AppError(403, 'FORBIDDEN', 'You cannot refund this order')
  const client = await pool.connect()
  let transactionOpen = false
  try {
    await client.query('BEGIN')
    transactionOpen = true
    const order = await lockOrder(client, orderId)
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found')
    if (user.role !== 'admin' && order.user_id !== user.id) throw new AppError(403, 'FORBIDDEN', 'You cannot refund this order')
    const existing = await client.query<RefundView>('SELECT id, order_id, payment_id, provider, provider_refund_id, amount, currency, status, reason, idempotency_key, created_at, updated_at FROM refunds WHERE order_id = $1 AND idempotency_key = $2 FOR UPDATE', [orderId, idempotencyKey])
    if (existing.rows[0]) {
      await client.query('COMMIT')
      if (existing.rows[0].status === 'processed') return normalizeRefund(existing.rows[0])
      throw new AppError(409, 'REFUND_ALREADY_ATTEMPTED', 'This refund reference has already been attempted')
    }
    const payment = await lockPayment(client, orderId)
    assertRefundable(order)
    if (!payment || payment.status !== 'captured' || !payment.provider_payment_id) throw new AppError(422, 'PAYMENT_NOT_REFUNDABLE', 'Payment is not captured')
    const amount = toMinorUnits(order.total_amount)
    if (input.amount !== undefined && toMinorUnits(input.amount.toFixed(2)) !== amount) throw new AppError(422, 'PARTIAL_REFUND_UNSUPPORTED', 'Only full refunds are supported')
    await assertTicketsNotUsed(client, orderId)
    const inserted = await client.query<{ id: string }>(`INSERT INTO refunds (order_id, payment_id, provider, amount, currency, status, reason, idempotency_key) VALUES ($1, $2, 'razorpay', $3, $4, 'pending', $5, $6) RETURNING id`, [orderId, payment.id, order.total_amount, order.currency.trim(), input.reason ?? null, idempotencyKey])
    await enqueueNotification(client, { userId: order.user_id, type: 'refund.requested', title: 'Refund requested', body: 'Your refund request is being processed.', data: { orderId, refundId: inserted.rows[0].id }, dedupeKey: `refund.requested:${inserted.rows[0].id}` })
    let providerRefund
    try {
      providerRefund = await createRazorpayRefund(payment.provider_payment_id, amount, { order_id: order.id })
    } catch {
      await client.query("UPDATE refunds SET status = 'failed', updated_at = NOW() WHERE id = $1", [inserted.rows[0].id])
      await enqueueNotification(client, { userId: order.user_id, type: 'refund.failed', title: 'Refund failed', body: 'Your refund could not be processed. Please contact support.', data: { orderId }, dedupeKey: `refund.failed:${inserted.rows[0].id}` })
      await client.query('COMMIT')
      transactionOpen = false
      await insertRefundAudit(user.id, orderId, inserted.rows[0].id, 'REFUND_FAILED', { reason: input.reason ?? null })
      throw new AppError(502, 'REFUND_PROVIDER_FAILED', 'The payment provider could not process the refund')
    }
    if (providerRefund.status !== 'processed' && providerRefund.status !== 'pending') throw new AppError(502, 'REFUND_PROVIDER_FAILED', 'The payment provider rejected the refund')
    await client.query("UPDATE refunds SET provider_refund_id = $2, status = 'processed', provider_metadata = $3, updated_at = NOW() WHERE id = $1", [inserted.rows[0].id, providerRefund.id, JSON.stringify({ providerStatus: providerRefund.status })])
    const items = await client.query<{ ticket_type_id: string; quantity: number }>('SELECT ticket_type_id, quantity FROM order_items WHERE order_id = $1 ORDER BY ticket_type_id FOR UPDATE', [orderId])
    for (const item of items.rows) { await client.query('SELECT id FROM ticket_types WHERE id = $1 FOR UPDATE', [item.ticket_type_id]); await client.query('UPDATE ticket_types SET quantity_sold = quantity_sold - $2, updated_at = NOW() WHERE id = $1', [item.ticket_type_id, item.quantity]) }
    await client.query("UPDATE tickets SET status = 'cancelled', updated_at = NOW() WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1) AND status = 'active'", [orderId])
    await client.query("UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = NOW() WHERE id = $1", [orderId])
    await client.query("UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1", [payment.id])
    await enqueueNotification(client, { userId: order.user_id, type: 'refund.processed', title: 'Refund processed', body: 'Your full refund has been processed and your tickets are no longer valid.', data: { orderId, refundId: inserted.rows[0].id }, dedupeKey: `refund.processed:${inserted.rows[0].id}` })
    await client.query('COMMIT')
    transactionOpen = false
    await insertRefundAudit(user.id, orderId, inserted.rows[0].id, 'REFUND_PROCESSED', { amount: order.total_amount, currency: order.currency.trim() })
    return normalizeRefund((await pool.query<RefundView>('SELECT id, order_id, payment_id, provider, provider_refund_id, amount, currency, status, reason, idempotency_key, created_at, updated_at FROM refunds WHERE id = $1', [inserted.rows[0].id])).rows[0])
  } catch (error) { if (transactionOpen) await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function listRefunds(user: AuthenticatedUser, orderId: string): Promise<RefundView[]> {
  const order = await pool.query<{ user_id: string }>('SELECT user_id FROM orders WHERE id = $1', [orderId])
  if (!order.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Order not found')
  if (user.role !== 'admin' && order.rows[0].user_id !== user.id) throw new AppError(403, 'FORBIDDEN', 'You cannot view these refunds')
  const result = await pool.query<RefundView>('SELECT id, order_id, payment_id, provider, provider_refund_id, amount, currency, status, reason, idempotency_key, created_at, updated_at FROM refunds WHERE order_id = $1 ORDER BY created_at DESC', [orderId])
  return result.rows.map(normalizeRefund)
}

async function lockOrder(client: PoolClient, orderId: string): Promise<LockedOrder | null> { return (await client.query<LockedOrder>('SELECT id, user_id, status, payment_status, total_amount, currency FROM orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0] ?? null }
async function lockPayment(client: PoolClient, orderId: string): Promise<PaymentRow | null> { return (await client.query<PaymentRow>('SELECT id, provider_payment_id, amount, currency, status FROM payments WHERE order_id = $1 FOR UPDATE', [orderId])).rows[0] ?? null }
function assertRefundable(order: LockedOrder): void { if (order.status === 'refunded' || order.payment_status === 'refunded') throw new AppError(409, 'ORDER_ALREADY_REFUNDED', 'Order is already refunded'); if (order.status !== 'confirmed' || order.payment_status !== 'paid') throw new AppError(422, 'ORDER_NOT_REFUNDABLE', 'Only paid confirmed orders can be refunded') }
async function assertTicketsNotUsed(client: PoolClient, orderId: string): Promise<void> { const result = await client.query('SELECT 1 FROM tickets WHERE order_item_id IN (SELECT id FROM order_items WHERE order_id = $1) AND status = \'used\' LIMIT 1', [orderId]); if (result.rows[0]) throw new AppError(422, 'TICKET_ALREADY_CHECKED_IN', 'Checked-in tickets cannot be refunded') }
function toMinorUnits(value: string): number { const [whole, fraction = ''] = value.split('.'); return Number(`${whole}${fraction.padEnd(2, '0').slice(0, 2)}`) }
function normalizeRefund(refund: RefundView): RefundView { return { ...refund, created_at: normalizeDate(refund.created_at), updated_at: normalizeDate(refund.updated_at) } }
function normalizeDate(value: string | Date): string { return value instanceof Date ? value.toISOString() : value }
async function insertRefundAudit(actorId: string, orderId: string, refundId: string, action: string, metadata: Record<string, unknown>): Promise<void> { await pool.query('INSERT INTO audit_logs (admin_user_id, actor_user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)', [null, actorId, action, 'refund', refundId, JSON.stringify({ orderId, ...metadata })]) }