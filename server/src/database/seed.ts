import argon2 from 'argon2'
import pool from '../config/database'

const developmentOnlyPassword = process.env.SEED_DEVELOPMENT_PASSWORD ?? 'eventora-development-only-password'

async function seed(): Promise<void> {
  const client = await pool.connect()
  const passwordHash = await argon2.hash(developmentOnlyPassword, { type: argon2.argon2id })

  try {
    await client.query('BEGIN')

    const userResult = await client.query<{ id: string }>(
      `
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          updated_at = NOW()
        RETURNING id
      `,
      [
        'Eventora Development Organizer',
        'organizer@example.test',
        passwordHash,
        'organizer',
      ],
    )
    const organizerId = userResult.rows[0].id

    const existingVenue = await client.query<{ id: string }>(
      'SELECT id FROM venues WHERE name = $1 AND city = $2 LIMIT 1',
      ['Eventora Development Hall', 'Testville'],
    )
    const venueId = existingVenue.rows[0]?.id ?? (
      await client.query<{ id: string }>(
        `
          INSERT INTO venues (name, address, city, state, country, postal_code)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `,
        ['Eventora Development Hall', '100 Example Avenue', 'Testville', 'TS', 'Testland', '00000'],
      )
    ).rows[0].id

    const eventResult = await client.query<{ id: string }>(
      `
        INSERT INTO events (organizer_id, venue_id, title, slug, description, status, start_at, end_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (slug) DO UPDATE SET
          organizer_id = EXCLUDED.organizer_id,
          venue_id = EXCLUDED.venue_id,
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          updated_at = NOW()
        RETURNING id
      `,
      [
        organizerId,
        venueId,
        'Eventora Development Conference',
        'eventora-development-conference',
        'Synthetic development data for validating the Eventora database relationships.',
        'published',
        '2030-06-01T10:00:00Z',
        '2030-06-01T18:00:00Z',
      ],
    )
    const eventId = eventResult.rows[0].id

    for (const ticketType of [
      ['General Admission', 'Standard development ticket', '25.00', 100],
      ['Workshop Pass', 'Optional development workshop ticket', '50.00', 25],
    ] as const) {
      await client.query(
        `
          INSERT INTO ticket_types (event_id, name, description, price, quantity, sales_start_at, sales_end_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (event_id, name) DO UPDATE SET
            description = EXCLUDED.description,
            price = EXCLUDED.price,
            quantity = EXCLUDED.quantity,
            sales_start_at = EXCLUDED.sales_start_at,
            sales_end_at = EXCLUDED.sales_end_at,
            updated_at = NOW()
        `,
        [eventId, ticketType[0], ticketType[1], ticketType[2], ticketType[3], '2029-01-01T00:00:00Z', '2030-05-31T23:59:59Z'],
      )
    }

    await client.query('COMMIT')
    console.log('Development seed data applied')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
