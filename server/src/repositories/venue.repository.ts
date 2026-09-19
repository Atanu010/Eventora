import pool from '../config/database'
import type { VenueView } from '../types/event'

export interface VenueInput {
  name: string
  address: string
  city: string
  state?: string | null
  country: string
  postal_code?: string | null
  latitude?: number | null
  longitude?: number | null
}

const venueColumns = 'id, name, address, city, state, country, postal_code, latitude, longitude'

export async function createVenue(input: VenueInput, ownerId: string): Promise<VenueView> {
  const result = await pool.query<VenueView>(
    `
      INSERT INTO venues (owner_id, name, address, city, state, country, postal_code, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING ${venueColumns}
    `,
    [ownerId, input.name, input.address, input.city, input.state ?? null, input.country, input.postal_code ?? null, input.latitude ?? null, input.longitude ?? null],
  )
  return result.rows[0]
}

export async function findVenueById(id: string): Promise<(VenueView & { owner_id: string | null }) | null> {
  const result = await pool.query<VenueView & { owner_id: string | null }>(
    `SELECT owner_id, ${venueColumns} FROM venues WHERE id = $1`,
    [id],
  )
  return result.rows[0] ?? null
}

export async function listVenues(ownerId?: string): Promise<VenueView[]> {
  const result = await pool.query<VenueView>(
    `SELECT ${venueColumns} FROM venues ${ownerId ? 'WHERE owner_id IS NULL OR owner_id = $1' : ''} ORDER BY name ASC`,
    ownerId ? [ownerId] : [],
  )
  return result.rows
}

export async function updateVenue(id: string, ownerId: string | null, input: Partial<VenueInput>): Promise<VenueView | null> {
  const result = await pool.query<VenueView>(
    `
      UPDATE venues SET
        name = COALESCE($3, name),
        address = COALESCE($4, address),
        city = COALESCE($5, city),
        state = $6,
        country = COALESCE($7, country),
        postal_code = $8,
        latitude = $9,
        longitude = $10,
        updated_at = NOW()
      WHERE id = $1 AND ($2::uuid IS NULL OR owner_id = $2)
      RETURNING ${venueColumns}
    `,
    [id, ownerId, input.name ?? null, input.address ?? null, input.city ?? null, input.state ?? null, input.country ?? null, input.postal_code ?? null, input.latitude ?? null, input.longitude ?? null],
  )
  return result.rows[0] ?? null
}

export async function deleteVenue(id: string, ownerId: string | null): Promise<boolean> {
  const result = await pool.query('DELETE FROM venues WHERE id = $1 AND ($2::uuid IS NULL OR owner_id = $2)', [id, ownerId])
  return result.rowCount === 1
}
