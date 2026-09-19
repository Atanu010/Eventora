import { AppError } from '../utils/errors'
import { createVenue, deleteVenue, findVenueById, listVenues, updateVenue } from '../repositories/venue.repository'
import type { AuthenticatedUser } from '../types/request'
import type { VenueView } from '../types/event'
import type { VenueInput } from '../repositories/venue.repository'

export async function createOrganizerVenue(user: AuthenticatedUser, input: VenueInput): Promise<VenueView> {
  return createVenue(input, user.id)
}

export async function getVenuesForUser(user?: AuthenticatedUser): Promise<VenueView[]> {
  return listVenues(user?.role === 'admin' ? undefined : user?.id)
}

export async function updateOrganizerVenue(user: AuthenticatedUser, id: string, input: Partial<VenueInput>): Promise<VenueView> {
  const existing = await findVenueById(id)
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Venue not found')
  if (user.role !== 'admin' && existing.owner_id !== user.id) throw new AppError(403, 'FORBIDDEN', 'You do not own this venue')
  const updated = await updateVenue(id, user.role === 'admin' ? null : user.id, {
    name: input.name ?? existing.name,
    address: input.address ?? existing.address,
    city: input.city ?? existing.city,
    state: input.state === undefined ? existing.state : input.state,
    country: input.country ?? existing.country,
    postal_code: input.postal_code === undefined ? existing.postal_code : input.postal_code,
    latitude: input.latitude === undefined ? existing.latitude ? Number(existing.latitude) : null : input.latitude,
    longitude: input.longitude === undefined ? existing.longitude ? Number(existing.longitude) : null : input.longitude,
  })
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Venue not found')
  return updated
}

export async function deleteOrganizerVenue(user: AuthenticatedUser, id: string): Promise<void> {
  const existing = await findVenueById(id)
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Venue not found')
  if (user.role !== 'admin' && existing.owner_id !== user.id) throw new AppError(403, 'FORBIDDEN', 'You do not own this venue')
  if (!(await deleteVenue(id, user.role === 'admin' ? null : user.id))) throw new AppError(404, 'NOT_FOUND', 'Venue not found')
}
