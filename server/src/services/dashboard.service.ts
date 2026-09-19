import pool from '../config/database'
import type { AuthenticatedUser } from '../types/request'
import type { DashboardEvent, DashboardSummary } from '../types/dashboard'

export async function getDashboardSummary(user: AuthenticatedUser): Promise<DashboardSummary> {
  const values: string[] = []
  const ownerClause = user.role === 'admin' ? '' : `WHERE e.organizer_id = $${values.push(user.id)}`
  const result = await pool.query<DashboardEvent>(
    `SELECT e.id AS "eventId", e.title, e.status, e.start_at AS "startAt",
      (SELECT COALESCE(SUM(oi.quantity), 0)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN ticket_types itt ON itt.id = oi.ticket_type_id WHERE itt.event_id = e.id AND o.status = 'confirmed' AND o.payment_status = 'paid') AS "ticketsSold",
      (SELECT COUNT(*)::int FROM tickets t JOIN order_items toi ON toi.id = t.order_item_id JOIN orders to2 ON to2.id = toi.order_id JOIN ticket_types ttt ON ttt.id = toi.ticket_type_id WHERE ttt.event_id = e.id AND to2.status = 'confirmed' AND to2.payment_status = 'paid' AND t.status = 'used') AS "ticketsCheckedIn",
      (SELECT GREATEST(COALESCE(SUM(quantity - quantity_sold), 0), 0)::int FROM ticket_types WHERE event_id = e.id) AS "remainingInventory",
      (SELECT COALESCE(SUM(oi.subtotal), 0)::numeric(12, 2)::text FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN ticket_types itt ON itt.id = oi.ticket_type_id WHERE itt.event_id = e.id AND o.status = 'confirmed' AND o.payment_status = 'paid') AS "grossRevenue"
     FROM events e
     ${ownerClause}
     GROUP BY e.id
     ORDER BY e.start_at ASC, e.id ASC`,
    values,
  )
  const events = result.rows
  return {
    totals: {
      events: events.length,
      publishedEvents: events.filter((event) => event.status === 'published').length,
      grossRevenue: sumMoney(events.map((event) => event.grossRevenue)),
      ticketsSold: events.reduce((total, event) => total + event.ticketsSold, 0),
      ticketsCheckedIn: events.reduce((total, event) => total + event.ticketsCheckedIn, 0),
      remainingInventory: events.reduce((total, event) => total + event.remainingInventory, 0),
    },
    events: events.map(normalizeEvent),
  }
}

function normalizeEvent(event: DashboardEvent): DashboardEvent {
  return { ...event, startAt: normalizeTimestamp(event.startAt), grossRevenue: Number(event.grossRevenue).toFixed(2) }
}

function normalizeTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value
}

function sumMoney(values: string[]): string {
  return values.reduce((total, value) => total + Number(value), 0).toFixed(2)
}