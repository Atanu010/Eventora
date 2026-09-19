import type { NextFunction, Request, Response } from 'express'
import { getEventsForUser, getEventForUser, createOrganizerEvent, updateOrganizerEvent, deleteOrganizerEvent } from '../services/event.service'
import { createEventSchema, eventIdSchema, eventQuerySchema, updateEventSchema } from '../validation/event.schemas'

export async function create(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const event = await createOrganizerEvent(request.authUser!, createEventSchema.parse(request.body))
    response.status(201).json({ event })
  } catch (error) { next(error) }
}

export async function list(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const query = eventQuerySchema.parse(request.query)
    const result = await getEventsForUser({
      page: query.page, limit: query.limit, search: query.search, status: query.status,
      city: query.city, startDate: query.start_date, endDate: query.end_date, includePublic: true,
    }, request.authUser)
    response.json({ data: result.data, pagination: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) } })
  } catch (error) { next(error) }
}

export async function getOne(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = eventIdSchema.parse(request.params)
    response.json(await getEventForUser(id, request.authUser))
  } catch (error) { next(error) }
}

export async function update(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = eventIdSchema.parse(request.params)
    response.json({ event: await updateOrganizerEvent(request.authUser!, id, updateEventSchema.parse(request.body)) })
  } catch (error) { next(error) }
}

export async function remove(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = eventIdSchema.parse(request.params)
    await deleteOrganizerEvent(request.authUser!, id)
    response.status(204).send()
  } catch (error) { next(error) }
}
