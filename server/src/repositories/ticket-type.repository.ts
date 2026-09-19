import pool from '../config/database'
import type { TicketTypeView } from '../types/event'

export interface TicketTypeInput {
  name: string
  description?: string | null
  price: number
  quantity: number
  salesStartAt?: string | null
  salesEndAt?: string | null
}

const columns = 'id, event_id, name, description, price, quantity, quantity_sold, sales_start_at, sales_end_at, created_at, updated_at'

export async function createTicketType(eventId: string, input: TicketTypeInput): Promise<TicketTypeView> {
  const result = await pool.query<TicketTypeView>(
    `INSERT INTO ticket_types (event_id, name, description, price, quantity, sales_start_at, sales_end_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${columns}`,
    [eventId, input.name, input.description ?? null, input.price, input.quantity, input.salesStartAt ?? null, input.salesEndAt ?? null],
  )
  return result.rows[0]
}

export async function listTicketTypes(eventId: string): Promise<TicketTypeView[]> {
  const result = await pool.query<TicketTypeView>(`SELECT ${columns} FROM ticket_types WHERE event_id = $1 ORDER BY name ASC`, [eventId])
  return result.rows
}

export async function findTicketType(id: string): Promise<(TicketTypeView & { organizer_id: string; event_status: string }) | null> {
  const result = await pool.query<TicketTypeView & { organizer_id: string; event_status: string }>(
    `SELECT tt.*, e.organizer_id, e.status AS event_status FROM ticket_types tt JOIN events e ON e.id = tt.event_id WHERE tt.id = $1`,
    [id],
  )
  return result.rows[0] ?? null
}

export async function updateTicketType(id: string, input: Partial<TicketTypeInput>): Promise<TicketTypeView | null> {
  const result = await pool.query<TicketTypeView>(
    `
      UPDATE ticket_types SET name = COALESCE($2, name), description = $3,
        price = COALESCE($4, price), quantity = COALESCE($5, quantity),
        sales_start_at = $6, sales_end_at = $7, updated_at = NOW()
      WHERE id = $1 RETURNING ${columns}
    `,
    [id, input.name ?? null, input.description ?? null, input.price ?? null, input.quantity ?? null, input.salesStartAt ?? null, input.salesEndAt ?? null],
  )
  return result.rows[0] ?? null
}

export async function deleteTicketType(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM ticket_types WHERE id = $1', [id])
  return result.rowCount === 1
}
