import { AppError } from '../utils/errors'
import {
  createEvent,
  deleteEvent,
  findEventById,
  findSlug,
  listEvents,
  updateEvent,
} from '../repositories/event.repository'
import { findVenueById } from '../repositories/venue.repository'
import type { AuthenticatedUser } from '../types/request'
import type { EventStatus, EventView } from '../types/event'

const transitions: Record<EventStatus, EventStatus[]> = {
  draft: ['draft', 'published', 'cancelled'],
  published: ['published', 'cancelled', 'completed'],
  cancelled: ['cancelled'],
  completed: ['completed'],
}

export async function createOrganizerEvent(user: AuthenticatedUser, input: {
  title: string
  description?: string | null
  venue_id?: string | null
  start_at: string
  end_at: string
}): Promise<EventView> {
  await assertVenueAccess(input.venue_id, user)
  return createEvent({
    organizerId: user.id,
    venueId: input.venue_id,
    title: input.title,
    slug: await createUniqueSlug(input.title),
    description: input.description,
    status: 'draft',
    startAt: input.start_at,
    endAt: input.end_at,
  })
}

export async function getEventForUser(id: string, user?: AuthenticatedUser): Promise<EventView> {
  const event = await findEventById(id)
  if (!event) throw new AppError(404, 'NOT_FOUND', 'Event not found')
  if (event.status === 'published') return event
  if (user && (user.role === 'admin' || event.organizer_id === user.id)) return event
  throw new AppError(404, 'NOT_FOUND', 'Event not found')
}

export async function getEventsForUser(options: Parameters<typeof listEvents>[0], user?: AuthenticatedUser) {
  return listEvents({ ...options, ownerId: user?.role === 'organizer' ? user.id : user?.role === 'admin' ? undefined : undefined, includePublic: true })
}

export async function updateOrganizerEvent(user: AuthenticatedUser, id: string, input: {
  title?: string
  description?: string | null
  venue_id?: string | null
  start_at?: string
  end_at?: string
  status?: EventStatus
}): Promise<EventView> {
  const existing = await getOwnedEvent(id, user)
  const nextStatus = input.status ?? existing.status
  if (!transitions[existing.status].includes(nextStatus)) {
    throw new AppError(400, 'INVALID_STATUS_TRANSITION', `Cannot change event status from ${existing.status} to ${nextStatus}`)
  }
  const startAt = input.start_at ?? existing.start_at
  const endAt = input.end_at ?? existing.end_at
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'end_at must be later than start_at')
  }
  await assertVenueAccess(input.venue_id === undefined ? existing.venue_id : input.venue_id, user)
  const title = input.title ?? existing.title
  const slug = existing.status === 'published' ? existing.slug : input.title ? await createUniqueSlug(title, id) : existing.slug
  return (await updateEvent(id, {
    venueId: input.venue_id === undefined ? existing.venue_id : input.venue_id,
    title,
    slug,
    description: input.description === undefined ? existing.description : input.description,
    status: nextStatus,
    startAt,
    endAt,
  }))!
}

export async function deleteOrganizerEvent(user: AuthenticatedUser, id: string): Promise<void> {
  await getOwnedEvent(id, user)
  if (!(await deleteEvent(id))) throw new AppError(404, 'NOT_FOUND', 'Event not found')
}

export async function getOwnedEvent(id: string, user: AuthenticatedUser): Promise<EventView> {
  const event = await findEventById(id)
  if (!event) throw new AppError(404, 'NOT_FOUND', 'Event not found')
  if (user.role !== 'admin' && event.organizer_id !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You do not own this event')
  }
  return event
}

export async function assertVenueAccess(venueId: string | null | undefined, user: AuthenticatedUser): Promise<void> {
  if (!venueId || user.role === 'admin') return
  const venue = await findVenueById(venueId)
  if (!venue) throw new AppError(400, 'INVALID_VENUE', 'Venue not found')
  if (venue.owner_id && venue.owner_id !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot use another organizer\'s venue')
  }
}

async function createUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'event'
  let candidate = base
  let suffix = 2
  while (await findSlug(candidate, excludeId)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}
