import type { PoolClient } from 'pg'
import pool from '../config/database'
import { AppError } from '../utils/errors'
import type { AuthenticatedUser } from '../types/request'

interface LockedTicket {
  id: string
  ticket_number: string
  status: string
  used_at: Date | string | null
  event_title: string
  event_organizer_id: string
  ticket_type_name: string
  attendee_name: string
}

export interface CheckInResult {
  success: boolean
  alreadyCheckedIn: boolean
  ticketNumber: string
  eventTitle: string
  ticketType: string
  attendeeName: string
  checkedInAt: string
}

export async function checkInTicket(user: AuthenticatedUser, qrToken: string): Promise<CheckInResult> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const ticket = await lockTicketByToken(client, qrToken)
    if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Ticket could not be validated')
    if (user.role !== 'admin' && ticket.event_organizer_id !== user.id) {
      throw new AppError(403, 'FORBIDDEN', 'You cannot check in tickets for this event')
    }
    if (ticket.status === 'cancelled') throw new AppError(422, 'TICKET_CANCELLED', 'This ticket has been cancelled')
    if (ticket.status === 'used' && ticket.used_at) {
      await client.query('COMMIT')
      return toResult(ticket, true, ticket.used_at)
    }
    if (ticket.status !== 'active') throw new AppError(422, 'TICKET_INVALID', 'This ticket cannot be checked in')

    const updated = await client.query<{ used_at: Date | string }>(
      "UPDATE tickets SET status = 'used', used_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'active' RETURNING used_at",
      [ticket.id],
    )
    if (!updated.rows[0]) throw new AppError(409, 'TICKET_CHECK_IN_CONFLICT', 'Ticket check-in could not be completed')
    await client.query('COMMIT')
    return toResult(ticket, false, updated.rows[0].used_at)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function lockTicketByToken(client: PoolClient, qrToken: string): Promise<LockedTicket | null> {
  const result = await client.query<LockedTicket>(
    `SELECT t.id, t.ticket_number, t.status, t.used_at,
      e.title AS event_title, e.organizer_id AS event_organizer_id,
      tt.name AS ticket_type_name, u.name AS attendee_name
     FROM tickets t
     JOIN order_items oi ON oi.id = t.order_item_id
     JOIN ticket_types tt ON tt.id = oi.ticket_type_id
     JOIN events e ON e.id = tt.event_id
     JOIN users u ON u.id = t.user_id
     WHERE t.qr_token = $1
     FOR UPDATE OF t`,
    [qrToken],
  )
  return result.rows[0] ?? null
}

function toResult(ticket: LockedTicket, alreadyCheckedIn: boolean, checkedInAt: Date | string): CheckInResult {
  return {
    success: true,
    alreadyCheckedIn,
    ticketNumber: ticket.ticket_number,
    eventTitle: ticket.event_title,
    ticketType: ticket.ticket_type_name,
    attendeeName: ticket.attendee_name,
    checkedInAt: checkedInAt instanceof Date ? checkedInAt.toISOString() : checkedInAt,
  }
}