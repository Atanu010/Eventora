import { randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import pool from '../config/database'
import { AppError } from '../utils/errors'
import { findEventById } from '../repositories/event.repository'
import {
  findAuthenticatedUser,
} from './auth.service'
import {
  findOrderById, findOrderItems, findIdempotentOrder, incrementInventory, insertOrderItem,
  insertPendingOrder, insertTicket, listOrderTickets, listOrdersForUser, listTicketsForUser,
  lockOrder, lockTicketType, releaseExpiredOrders, updateOrderPayment, updateOrderTotal,
  updatePendingOrderToCancelled,
} from '../repositories/order.repository'
import type { AuthenticatedUser } from '../types/request'
import type { OrderView, TicketView } from '../types/order'

const pendingOrderLifetimeMs = 30 * 60 * 1000

export async function createOrder(user: AuthenticatedUser, items: Array<{ ticketTypeId: string; quantity: number }>, idempotencyKey?: string): Promise<OrderView> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await releaseExpiredOrders(client)
    const normalized = aggregateItems(items)
    const orderNumber = `EVT-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`
    const inserted = await insertPendingOrder(client, { userId: user.id, orderNumber, idempotencyKey, expiresAt: new Date(Date.now() + pendingOrderLifetimeMs) })
    if (!inserted) {
      const existingId = idempotencyKey ? await findIdempotentOrder(client, user.id, idempotencyKey) : null
      if (!existingId) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'The order request conflicts with an existing request')
      await client.query('COMMIT')
      const existing = await findOrderById(existingId)
      if (!existing) throw new AppError(404, 'NOT_FOUND', 'Order not found')
      return existing
    }

    const locked = []
    for (const item of normalized) {
      const ticketType = await lockTicketType(client, item.ticketTypeId)
      if (!ticketType) throw new AppError(404, 'NOT_FOUND', 'Ticket type not found')
      if (ticketType.event_status !== 'published') throw new AppError(422, 'EVENT_NOT_PURCHASABLE', 'The event is not available for purchase')
      const now = Date.now()
      if ((ticketType.sales_start_at && now < new Date(ticketType.sales_start_at).getTime()) || (ticketType.sales_end_at && now > new Date(ticketType.sales_end_at).getTime())) {
        throw new AppError(422, 'SALES_WINDOW_INACTIVE', 'Ticket sales are not currently active')
      }
      if (ticketType.quantity - ticketType.quantity_sold < item.quantity) throw new AppError(409, 'INSUFFICIENT_INVENTORY', 'Insufficient ticket inventory')
      locked.push({ item, ticketType })
    }
    for (const entry of locked) {
      await incrementInventory(client, entry.ticketType.id, entry.item.quantity)
      await insertOrderItem(client, inserted.id, entry.ticketType.id, entry.item.quantity, entry.ticketType.price)
    }
    await updateOrderTotal(client, inserted.id)
    await client.query('COMMIT')
    return (await findOrderById(inserted.id))!
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getOrders(user: AuthenticatedUser): Promise<OrderView[]> {
  return listOrdersForUser(user.id, user.role)
}

export async function getOrder(user: AuthenticatedUser, id: string): Promise<OrderView> {
  const order = await findOrderById(id)
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found')
  await assertOrderAccess(user, order)
  return order
}

export async function getOrderTickets(user: AuthenticatedUser, id: string): Promise<TicketView[]> {
  const order = await getOrder(user, id)
  return listOrderTickets(order.id)
}

export async function getTickets(user: AuthenticatedUser, eventId?: string, status?: string): Promise<TicketView[]> {
  return listTicketsForUser(user.id, eventId, status)
}

export async function cancelPendingOrder(user: AuthenticatedUser, id: string): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await releaseExpiredOrders(client)
    const order = await lockOrder(client, id)
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found')
    if (order.user_id !== user.id && user.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'You cannot cancel this order')
    if (order.status !== 'pending') throw new AppError(422, 'ORDER_NOT_CANCELLABLE', 'Only pending orders can be cancelled')
    const items = await findOrderItems(client, id)
    for (const item of items) {
      await lockTicketType(client, item.ticket_type_id)
      await client.query('UPDATE ticket_types SET quantity_sold = quantity_sold - $2, updated_at = NOW() WHERE id = $1', [item.ticket_type_id, item.quantity])
    }
    await updatePendingOrderToCancelled(client, id)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function confirmOrderForDevelopment(id: string): Promise<OrderView> {
  if (process.env.NODE_ENV === 'production') throw new AppError(404, 'NOT_FOUND', 'Not found')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const order = await lockOrder(client, id)
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found')
    if (order.status === 'confirmed' && order.payment_status === 'paid') {
      await client.query('COMMIT')
      return (await findOrderById(id))!
    }
    if (order.status !== 'pending' || order.payment_status !== 'pending') throw new AppError(422, 'ORDER_NOT_CONFIRMABLE', 'Order is not awaiting payment')
    await updateOrderPayment(client, id)
    const items = await findOrderItems(client, id)
    for (const item of items) {
      for (let index = 0; index < item.quantity; index += 1) {
        await insertTicket(client, {
          orderItemId: item.id,
          ticketTypeId: item.ticket_type_id,
          userId: order.user_id,
          ticketNumber: `EVT-${randomBytes(7).toString('hex').toUpperCase()}`,
          qrToken: randomBytes(32).toString('base64url'),
        })
      }
    }
    await client.query('COMMIT')
    return (await findOrderById(id))!
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function assertOrderAccess(user: AuthenticatedUser, order: OrderView): Promise<void> {
  if (user.role === 'admin' || order.user_id === user.id) return
  if (user.role === 'organizer') {
    const event = await findEventById(order.items[0]?.event_id)
    if (event?.organizer_id === user.id) return
  }
  throw new AppError(403, 'FORBIDDEN', 'You cannot access this order')
}

function aggregateItems(items: Array<{ ticketTypeId: string; quantity: number }>): Array<{ ticketTypeId: string; quantity: number }> {
  const totals = new Map<string, number>()
  for (const item of items) totals.set(item.ticketTypeId, (totals.get(item.ticketTypeId) ?? 0) + item.quantity)
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }))
}
