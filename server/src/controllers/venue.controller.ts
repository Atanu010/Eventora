import type { NextFunction, Request, Response } from 'express'
import { createOrganizerVenue, deleteOrganizerVenue, getVenuesForUser, updateOrganizerVenue } from '../services/venue.service'
import { updateVenueSchema, venueIdSchema, venueSchema } from '../validation/event.schemas'

export async function create(request: Request, response: Response, next: NextFunction): Promise<void> {
  try { response.status(201).json({ venue: await createOrganizerVenue(request.authUser!, venueSchema.parse(request.body)) }) } catch (error) { next(error) }
}

export async function list(request: Request, response: Response, next: NextFunction): Promise<void> {
  try { response.json({ data: await getVenuesForUser(request.authUser) }) } catch (error) { next(error) }
}

export async function update(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = venueIdSchema.parse(request.params)
    response.json({ venue: await updateOrganizerVenue(request.authUser!, id, updateVenueSchema.parse(request.body)) })
  } catch (error) { next(error) }
}

export async function remove(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = venueIdSchema.parse(request.params)
    await deleteOrganizerVenue(request.authUser!, id)
    response.status(204).send()
  } catch (error) { next(error) }
}
