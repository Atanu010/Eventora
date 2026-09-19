import pool from '../config/database'
import type { EventStatus, EventView } from '../types/event'

export interface EventInput {
  organizerId: string
  venueId?: string | null
  title: string
  slug: string
  description?: string | null
  status: EventStatus
  startAt: string
  endAt: string
}

export interface EventListOptions {
  page: number
  limit: number
  search?: string
  status?: EventStatus
  city?: string
  startDate?: string
  endDate?: string
  ownerId?: string
  includePublic: boolean
}

const eventSelect = `
  SELECT e.id, e.organizer_id, u.name AS organizer_name, e.venue_id,
    v.name AS venue_name, v.address AS venue_address, v.city AS venue_city,
    v.state AS venue_state, v.country AS venue_country, v.postal_code AS venue_postal_code,
    v.latitude AS venue_latitude, v.longitude AS venue_longitude,
    e.title, e.slug, e.description, e.status, e.start_at, e.end_at,
    e.created_at, e.updated_at
  FROM events e
  JOIN users u ON u.id = e.organizer_id
  LEFT JOIN venues v ON v.id = e.venue_id
`

function mapEvent(row: Record<string, unknown>): EventView {
  return {
    id: row.id as string,
    organizer_id: row.organizer_id as string,
    organizer_name: row.organizer_name as string,
    venue_id: row.venue_id as string | null,
    venue: row.venue_id ? {
      id: row.venue_id as string,
      name: row.venue_name as string,
      address: row.venue_address as string,
      city: row.venue_city as string,
      state: row.venue_state as string | null,
      country: row.venue_country as string,
      postal_code: row.venue_postal_code as string | null,
      latitude: row.venue_latitude as string | null,
      longitude: row.venue_longitude as string | null,
    } : null,
    title: row.title as string,
    slug: row.slug as string,
    description: row.description as string | null,
    status: row.status as EventStatus,
    start_at: row.start_at as string,
    end_at: row.end_at as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function createEvent(input: EventInput): Promise<EventView> {
  const result = await pool.query(
    `
      INSERT INTO events (organizer_id, venue_id, title, slug, description, status, start_at, end_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `,
    [input.organizerId, input.venueId ?? null, input.title, input.slug, input.description ?? null, input.status, input.startAt, input.endAt],
  )
  return (await findEventById(result.rows[0].id))!
}

export async function findEventById(id: string): Promise<EventView | null> {
  const result = await pool.query(`${eventSelect} WHERE e.id = $1`, [id])
  return result.rows[0] ? mapEvent(result.rows[0]) : null
}

export async function listEvents(options: EventListOptions): Promise<{ data: EventView[]; total: number }> {
  const conditions: string[] = []
  const values: unknown[] = []
  const add = (value: unknown): string => { values.push(value); return `$${values.length}` }

  if (options.includePublic && options.ownerId) {
    const owner = add(options.ownerId)
    conditions.push(`(e.status = 'published' OR e.organizer_id = ${owner})`)
  } else if (options.includePublic) {
    conditions.push("e.status = 'published'")
  } else if (options.ownerId) {
    conditions.push(`e.organizer_id = ${add(options.ownerId)}`)
  }
  if (options.search) {
    const search = add(`%${options.search}%`)
    conditions.push(`(e.title ILIKE ${search} OR COALESCE(e.description, '') ILIKE ${search})`)
  }
  if (options.status) conditions.push(`e.status = ${add(options.status)}`)
  if (options.city) conditions.push(`v.city ILIKE ${add(options.city)}`)
  if (options.startDate) conditions.push(`e.start_at >= ${add(options.startDate)}`)
  if (options.endDate) conditions.push(`e.start_at <= ${add(options.endDate)}`)

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const countResult = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM events e LEFT JOIN venues v ON v.id = e.venue_id ${where}`, values)
  const total = Number(countResult.rows[0].count)
  const offset = (options.page - 1) * options.limit
  const limitParam = add(options.limit)
  const offsetParam = add(offset)
  const result = await pool.query(`${eventSelect} ${where} ORDER BY e.start_at ASC, e.id ASC LIMIT ${limitParam} OFFSET ${offsetParam}`, values)
  return { data: result.rows.map(mapEvent), total }
}

export async function findSlug(slug: string, excludeId?: string): Promise<boolean> {
  const result = await pool.query('SELECT 1 FROM events WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)', [slug, excludeId ?? null])
  return result.rowCount === 1
}

export async function updateEvent(id: string, input: Omit<EventInput, 'organizerId' | 'slug'> & { slug: string }): Promise<EventView | null> {
  const result = await pool.query(
    `
      UPDATE events SET venue_id = $2, title = $3, slug = $4, description = $5,
        status = $6, start_at = $7, end_at = $8, updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [id, input.venueId ?? null, input.title, input.slug, input.description ?? null, input.status, input.startAt, input.endAt],
  )
  return result.rows[0] ? findEventById(id) : null
}

export async function deleteEvent(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM events WHERE id = $1', [id])
  return result.rowCount === 1
}
