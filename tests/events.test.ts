import assert from 'node:assert/strict'
import { before, after, describe, it } from 'node:test'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool } from 'pg'

process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev'
process.env.JWT_SECRET ??= 'phase4-test-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN ??= '1h'

let app: Express
let pool: Pool
let organizerToken = ''
let secondOrganizerToken = ''
let attendeeToken = ''
let organizerId = ''
let secondOrganizerId = ''
let venueId = ''
let eventId = ''
let secondEventId = ''
let publicEventId = ''
let ticketTypeId = ''

async function registerAndLogin(email: string, role: 'attendee' | 'organizer'): Promise<string> {
  const password = 'phase4-strong-password'
  const registration = await request(app).post('/api/auth/register').send({
    name: role === 'organizer' ? 'Phase Four Organizer' : 'Phase Four Attendee',
    email,
    password,
  })
  assert.equal(registration.status, 201)

  const id = registration.body.user.id as string
  if (role === 'organizer') {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id])
  }

  const login = await request(app).post('/api/auth/login').send({ email, password })
  assert.equal(login.status, 200)
  return login.body.accessToken as string
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

before(async () => {
  ;({ default: app } = await import('../server/src/app'))
  ;({ default: pool } = await import('../server/src/config/database'))
  await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test'))")
  await pool.query("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test')")
  await pool.query("DELETE FROM tickets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test')")
  await pool.query("DELETE FROM ticket_types WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test'))")
  await pool.query("DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test')")
  await pool.query("DELETE FROM venues WHERE owner_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test')")
  await pool.query("DELETE FROM users WHERE email LIKE 'phase4-%@example.test'")

  organizerToken = await registerAndLogin('phase4-organizer@example.test', 'organizer')
  secondOrganizerToken = await registerAndLogin('phase4-second-organizer@example.test', 'organizer')
  attendeeToken = await registerAndLogin('phase4-attendee@example.test', 'attendee')
  const organizer = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', ['phase4-organizer@example.test'])
  const secondOrganizer = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', ['phase4-second-organizer@example.test'])
  organizerId = organizer.rows[0].id
  secondOrganizerId = secondOrganizer.rows[0].id
})

after(async () => {
  if (!pool) return
  await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test'))")
  await pool.query("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test')")
  await pool.query("DELETE FROM tickets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test')")
  await pool.query("DELETE FROM ticket_types WHERE event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test'))")
  await pool.query("DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test')")
  await pool.query("DELETE FROM venues WHERE owner_id IN (SELECT id FROM users WHERE email LIKE 'phase4-%@example.test')")
  await pool.query("DELETE FROM users WHERE email LIKE 'phase4-%@example.test'")
  await pool.end()
})

describe('event ownership and lifecycle', () => {
  it('creates a venue and a draft event for the organizer', async () => {
    const venue = await request(app).post('/api/venues').set(auth(organizerToken)).send({
      name: 'Phase Four Hall', address: '1 Test Street', city: 'Phaseville', country: 'Testland', postal_code: '00000',
    })
    assert.equal(venue.status, 201)
    venueId = venue.body.venue.id

    const event = await request(app).post('/api/events').set(auth(organizerToken)).send({
      title: 'Phase Four Public Conference', description: 'A searchable event for Phase Four tests.', venue_id: venueId,
      start_at: '2030-07-01T10:00:00Z', end_at: '2030-07-01T18:00:00Z',
    })
    assert.equal(event.status, 201)
    assert.equal(event.body.event.status, 'draft')
    assert.equal(event.body.event.organizer_id, organizerId)
    eventId = event.body.event.id
  })

  it('rejects unauthenticated, attendee, invalid, and missing-title creation', async () => {
    const unauthenticated = await request(app).post('/api/events').send({ title: 'No Auth', start_at: '2030-07-01T10:00:00Z', end_at: '2030-07-01T11:00:00Z' })
    const attendee = await request(app).post('/api/events').set(auth(attendeeToken)).send({ title: 'No Role', start_at: '2030-07-01T10:00:00Z', end_at: '2030-07-01T11:00:00Z' })
    const invalidDates = await request(app).post('/api/events').set(auth(organizerToken)).send({ title: 'Bad Dates', start_at: '2030-07-02T10:00:00Z', end_at: '2030-07-01T11:00:00Z' })
    const missingTitle = await request(app).post('/api/events').set(auth(organizerToken)).send({ start_at: '2030-07-01T10:00:00Z', end_at: '2030-07-01T11:00:00Z' })
    assert.equal(unauthenticated.status, 401)
    assert.equal(attendee.status, 403)
    assert.equal(invalidDates.status, 400)
    assert.equal(missingTitle.status, 400)
  })

  it('allows the owner to retrieve and update a draft, but not another organizer', async () => {
    const own = await request(app).get(`/api/events/${eventId}`).set(auth(organizerToken))
    assert.equal(own.status, 200)
    const other = await request(app).get(`/api/events/${eventId}`).set(auth(secondOrganizerToken))
    assert.equal(other.status, 404)

    const forbidden = await request(app).patch(`/api/events/${eventId}`).set(auth(secondOrganizerToken)).send({ title: 'Hijacked Event' })
    assert.equal(forbidden.status, 403)
    const updated = await request(app).patch(`/api/events/${eventId}`).set(auth(organizerToken)).send({ title: 'Updated Phase Four Conference' })
    assert.equal(updated.status, 200)
  })

  it('enforces valid publication and cancellation transitions', async () => {
    const published = await request(app).patch(`/api/events/${eventId}`).set(auth(organizerToken)).send({ status: 'published' })
    assert.equal(published.status, 200)
    assert.equal(published.body.event.status, 'published')
    const invalid = await request(app).patch(`/api/events/${eventId}`).set(auth(organizerToken)).send({ status: 'draft' })
    assert.equal(invalid.status, 400)
    const cancelled = await request(app).patch(`/api/events/${eventId}`).set(auth(organizerToken)).send({ status: 'cancelled' })
    assert.equal(cancelled.status, 200)
  })

  it('protects venue ownership and event venue relationships', async () => {
    const forbiddenVenue = await request(app).patch(`/api/venues/${venueId}`).set(auth(secondOrganizerToken)).send({ city: 'Other City' })
    assert.equal(forbiddenVenue.status, 403)
    const secondEvent = await request(app).post('/api/events').set(auth(secondOrganizerToken)).send({ title: 'Second Organizer Draft', start_at: '2030-08-01T10:00:00Z', end_at: '2030-08-01T11:00:00Z' })
    assert.equal(secondEvent.status, 201)
    secondEventId = secondEvent.body.event.id
    const venueHijack = await request(app).patch(`/api/events/${secondEventId}`).set(auth(secondOrganizerToken)).send({ venue_id: venueId })
    assert.equal(venueHijack.status, 403)
  })
})

describe('public discovery and ticket-type foundation', () => {
  it('creates and publishes a searchable event', async () => {
    const event = await request(app).post('/api/events').set(auth(organizerToken)).send({ title: 'Phase Four Searchable Event', venue_id: venueId, start_at: '2030-09-01T10:00:00Z', end_at: '2030-09-01T11:00:00Z' })
    assert.equal(event.status, 201)
    publicEventId = event.body.event.id
    const published = await request(app).patch(`/api/events/${publicEventId}`).set(auth(organizerToken)).send({ status: 'published' })
    assert.equal(published.status, 200)

    const ticket = await request(app).post(`/api/events/${publicEventId}/ticket-types`).set(auth(organizerToken)).send({ name: 'General Admission', price: 10, quantity: 100, sales_start_at: '2030-01-01T00:00:00Z', sales_end_at: '2030-08-31T23:59:59Z' })
    assert.equal(ticket.status, 201)
    ticketTypeId = ticket.body.ticketType.id
  })

  it('supports public filtering, date/city search, pagination, and hides drafts/cancelled events', async () => {
    const publicResult = await request(app).get('/api/events?search=Searchable&city=Phaseville&start_date=2030-08-01T00:00:00Z&end_date=2030-10-01T00:00:00Z&page=1&limit=1')
    assert.equal(publicResult.status, 200)
    assert.equal(publicResult.body.data.length, 1)
    assert.equal(publicResult.body.pagination.limit, 1)
    assert.equal(publicResult.body.data[0].id, publicEventId)

    const draftResult = await request(app).get('/api/events?status=draft')
    assert.equal(draftResult.status, 200)
    assert.equal(draftResult.body.data.some((event: { id: string }) => event.id === secondEventId), false)

    const cancelledDetail = await request(app).get(`/api/events/${eventId}`)
    assert.equal(cancelledDetail.status, 404)
  })

  it('protects and exposes ticket types according to event visibility and ownership', async () => {
    const publicTypes = await request(app).get(`/api/events/${publicEventId}/ticket-types`)
    assert.equal(publicTypes.status, 200)
    assert.equal(publicTypes.body.data[0].id, ticketTypeId)

    const attendeeCreate = await request(app).post(`/api/events/${publicEventId}/ticket-types`).set(auth(attendeeToken)).send({ name: 'Attendee Ticket', price: 5, quantity: 1 })
    assert.equal(attendeeCreate.status, 403)
    const invalidPrice = await request(app).post(`/api/events/${publicEventId}/ticket-types`).set(auth(organizerToken)).send({ name: 'Invalid Price', price: -1, quantity: 1 })
    assert.equal(invalidPrice.status, 400)
    const invalidWindow = await request(app).post(`/api/events/${publicEventId}/ticket-types`).set(auth(organizerToken)).send({ name: 'Invalid Window', price: 1, quantity: 1, sales_start_at: '2030-08-01T00:00:00Z', sales_end_at: '2030-07-01T00:00:00Z' })
    assert.equal(invalidWindow.status, 400)
    const forbiddenUpdate = await request(app).patch(`/api/events/${publicEventId}/ticket-types/${ticketTypeId}`).set(auth(secondOrganizerToken)).send({ price: 20 })
    assert.equal(forbiddenUpdate.status, 403)
  })

  it('allows the owner to delete an appropriate draft event', async () => {
    const deleted = await request(app).delete(`/api/events/${secondEventId}`).set(auth(secondOrganizerToken))
    assert.equal(deleted.status, 204)
    const missing = await request(app).get(`/api/events/${secondEventId}`)
    assert.equal(missing.status, 404)
  })
})
