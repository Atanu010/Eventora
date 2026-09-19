import type { NextFunction, Request, Response } from 'express'
import { createOrganizerTicketType, deleteOrganizerTicketType, getTicketTypesForUser, updateOrganizerTicketType } from '../services/ticket-type.service'
import { createTicketTypeSchema, eventAndTicketTypeIdSchema, eventParamSchema, updateTicketTypeSchema } from '../validation/event.schemas'

export async function create(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { eventId } = eventParamSchema.parse(request.params)
    const input = createTicketTypeSchema.parse(request.body)
    response.status(201).json({ ticketType: await createOrganizerTicketType(request.authUser!, eventId, {
      name: input.name,
      description: input.description,
      price: input.price,
      quantity: input.quantity,
      salesStartAt: input.sales_start_at,
      salesEndAt: input.sales_end_at,
    }) })
  } catch (error) { next(error) }
}

export async function list(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { eventId } = eventParamSchema.parse(request.params)
    response.json({ data: await getTicketTypesForUser(eventId, request.authUser) })
  } catch (error) { next(error) }
}

export async function update(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { eventId, ticketTypeId } = eventAndTicketTypeIdSchema.parse(request.params)
    const input = updateTicketTypeSchema.parse(request.body)
    response.json({ ticketType: await updateOrganizerTicketType(request.authUser!, eventId, ticketTypeId, {
      name: input.name,
      description: input.description,
      price: input.price,
      quantity: input.quantity,
      salesStartAt: input.sales_start_at,
      salesEndAt: input.sales_end_at,
    }) })
  } catch (error) { next(error) }
}

export async function remove(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { eventId, ticketTypeId } = eventAndTicketTypeIdSchema.parse(request.params)
    await deleteOrganizerTicketType(request.authUser!, eventId, ticketTypeId)
    response.status(204).send()
  } catch (error) { next(error) }
}
