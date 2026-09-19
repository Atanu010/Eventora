import type { PoolClient } from 'pg'
import type { OrderItemView, OrderView, TicketView } from '../types/order'
import pool from '../config/database'

export interface LockedTicketType {
  id: string
  event_id: string
  event_status: string
  sales_start_at: string | null
  sales_end_at: string | null
  price: string
  quantity: number
  quantity_sold: number
}

export interface OrderInput {
  userId: string
  orderNumber: string
  idempotencyKey?: string
  expiresAt: Date
}

export async function lockTicketType(client: PoolClient, id: string): Promise<LockedTicketType | null> {
  const result = await client.query<LockedTicketType>(
    `
      SELECT tt.id, tt.event_id, e.status AS event_status, tt.sales_start_at,
        tt.sales_end_at, tt.price, tt.quantity, tt.quantity_sold
      FROM ticket_types tt
      JOIN events e ON e.id = tt.event_id
      WHERE tt.id = $1
      FOR UPDATE OF tt
    `,
    [id],
  )
  return result.rows[0] ?? null
}

export async function insertPendingOrder(client: PoolClient, input: OrderInput): Promise<{ id: string } | null> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO orders (user_id, order_number, status, payment_status, total_amount, currency, expires_at, idempotency_key)
      VALUES ($1, $2, 'pending', 'pending', 0, 'USD', $3, $4)
      ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
      RETURNING id
    `,
    [input.userId, input.orderNumber, input.expiresAt, input.idempotencyKey ?? null],
  )
  return result.rows[0] ?? null
}

export async function findIdempotentOrder(client: PoolClient, userId: string, key: string): Promise<string | null> {
  const result = await client.query<{ id: string }>('SELECT id FROM orders WHERE user_id = $1 AND idempotency_key = $2 FOR UPDATE', [userId, key])
  return result.rows[0]?.id ?? null
}

export async function incrementInventory(client: PoolClient, ticketTypeId: string, quantity: number): Promise<void> {
  await client.query('UPDATE ticket_types SET quantity_sold = quantity_sold + $2, updated_at = NOW() WHERE id = $1', [ticketTypeId, quantity])
}

export async function insertOrderItem(client: PoolClient, orderId: string, ticketTypeId: string, quantity: number, price: string): Promise<void> {
  await client.query(
    `INSERT INTO order_items (order_id, ticket_type_id, quantity, unit_price, subtotal)
    VALUES ($1, $2, $3::integer, $4::numeric, $4::numeric * $3::numeric)`,
    [orderId, ticketTypeId, quantity, price],
  )
}

export async function updateOrderTotal(client: PoolClient, orderId: string): Promise<void> {
  await client.query(
    'UPDATE orders SET total_amount = (SELECT COALESCE(SUM(subtotal), 0) FROM order_items WHERE order_id = $1), updated_at = NOW() WHERE id = $1',
    [orderId],
  )
}

export async function releaseExpiredOrders(client: PoolClient): Promise<void> {
  const expired = await client.query<{ id: string }>("SELECT id FROM orders WHERE status = 'pending' AND expires_at <= NOW() FOR UPDATE")
  for (const order of expired.rows) {
    const items = await client.query<{ ticket_type_id: string; quantity: number }>('SELECT ticket_type_id, quantity FROM order_items WHERE order_id = $1 ORDER BY ticket_type_id FOR UPDATE', [order.id])
    for (const item of items.rows) {
      await client.query('UPDATE ticket_types SET quantity_sold = quantity_sold - $2, updated_at = NOW() WHERE id = $1', [item.ticket_type_id, item.quantity])
    }
    await client.query("UPDATE orders SET status = 'expired', payment_status = 'failed', updated_at = NOW() WHERE id = $1", [order.id])
  }
}

export async function lockOrder(client: PoolClient, id: string): Promise<{ id: string; user_id: string; status: string; payment_status: string } | null> {
  const result = await client.query<{ id: string; user_id: string; status: string; payment_status: string }>('SELECT id, user_id, status, payment_status FROM orders WHERE id = $1 FOR UPDATE', [id])
  return result.rows[0] ?? null
}

export async function findOrderById(id: string): Promise<OrderView | null> {
  const orderResult = await pool.query<Omit<OrderView, 'items'>>('SELECT id, user_id, order_number, status, payment_status, total_amount, currency, expires_at, created_at, updated_at FROM orders WHERE id = $1', [id])
  if (!orderResult.rows[0]) return null
  const itemResult = await pool.query<OrderItemView>(
    `SELECT oi.id, oi.order_id, oi.ticket_type_id, tt.event_id, e.title AS event_title, oi.quantity, oi.unit_price, oi.subtotal
     FROM order_items oi JOIN ticket_types tt ON tt.id = oi.ticket_type_id JOIN events e ON e.id = tt.event_id WHERE oi.order_id = $1 ORDER BY oi.id`,
    [id],
  )
  return { ...orderResult.rows[0], items: itemResult.rows }
}

export async function listOrdersForUser(userId: string, role: string): Promise<OrderView[]> {
  const condition = role === 'admin' ? '' : role === 'organizer'
    ? 'WHERE o.user_id = $1 OR EXISTS (SELECT 1 FROM order_items oi2 JOIN ticket_types tt2 ON tt2.id = oi2.ticket_type_id JOIN events e2 ON e2.id = tt2.event_id WHERE oi2.order_id = o.id AND e2.organizer_id = $1)'
    : 'WHERE o.user_id = $1'
  const result = await pool.query<Omit<OrderView, 'items'>>(`SELECT o.id, o.user_id, o.order_number, o.status, o.payment_status, o.total_amount, o.currency, o.expires_at, o.created_at, o.updated_at FROM orders o ${condition} ORDER BY o.created_at DESC`, role === 'admin' ? [] : [userId])
  return Promise.all(result.rows.map(async (order) => ({ ...order, items: (await pool.query<OrderItemView>('SELECT oi.id, oi.order_id, oi.ticket_type_id, tt.event_id, e.title AS event_title, oi.quantity, oi.unit_price, oi.subtotal FROM order_items oi JOIN ticket_types tt ON tt.id = oi.ticket_type_id JOIN events e ON e.id = tt.event_id WHERE oi.order_id = $1 ORDER BY oi.id', [order.id])).rows })))
}

export async function updateOrderPayment(client: PoolClient, id: string): Promise<void> {
  await client.query("UPDATE orders SET payment_status = 'paid', status = 'confirmed', updated_at = NOW() WHERE id = $1", [id])
}

export async function listOrderTickets(orderId: string): Promise<TicketView[]> {
  const result = await pool.query<TicketView>(
    `SELECT t.id, t.order_item_id, t.ticket_type_id, e.id AS event_id, e.title AS event_title,
      t.user_id, t.ticket_number, t.qr_token, t.status, t.issued_at, t.used_at, t.created_at, t.updated_at
    FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id JOIN events e ON e.id = tt.event_id
     WHERE t.order_item_id IN (SELECT id FROM order_items WHERE order_id = $1) ORDER BY t.ticket_number`,
    [orderId],
  )
  return result.rows
}

export async function listTicketsForUser(userId: string, eventId?: string, status?: string): Promise<TicketView[]> {
  const values: unknown[] = [userId]
  const conditions = ['t.user_id = $1']
  if (eventId) { values.push(eventId); conditions.push(`e.id = $${values.length}`) }
  if (status) { values.push(status); conditions.push(`t.status = $${values.length}`) }
  const result = await pool.query<TicketView>(
    `SELECT t.id, t.order_item_id, t.ticket_type_id, e.id AS event_id, e.title AS event_title,
      t.user_id, t.ticket_number, t.qr_token, t.status, t.issued_at, t.used_at, t.created_at, t.updated_at
     FROM tickets t JOIN ticket_types tt ON tt.id = t.ticket_type_id JOIN events e ON e.id = tt.event_id
     WHERE ${conditions.join(' AND ')} ORDER BY t.issued_at DESC`,
    values,
  )
  return result.rows
}

export async function insertTicket(client: PoolClient, input: { orderItemId: string; ticketTypeId: string; userId: string; ticketNumber: string; qrToken: string }): Promise<void> {
  await client.query(
    `INSERT INTO tickets (order_item_id, ticket_type_id, user_id, ticket_number, qr_token, status)
     VALUES ($1, $2, $3, $4, $5, 'active')`,
    [input.orderItemId, input.ticketTypeId, input.userId, input.ticketNumber, input.qrToken],
  )
}

export async function findOrderItems(client: PoolClient, orderId: string): Promise<Array<{ id: string; ticket_type_id: string; quantity: number }>> {
  return (await client.query<{ id: string; ticket_type_id: string; quantity: number }>('SELECT id, ticket_type_id, quantity FROM order_items WHERE order_id = $1 ORDER BY id', [orderId])).rows
}

export async function updatePendingOrderToCancelled(client: PoolClient, id: string): Promise<void> {
  await client.query("UPDATE orders SET status = 'cancelled', payment_status = 'failed', updated_at = NOW() WHERE id = $1", [id])
}
