import { AppError } from '../utils/errors'
import { createTicketType, deleteTicketType, findTicketType, listTicketTypes, updateTicketType } from '../repositories/ticket-type.repository'
import { getOwnedEvent } from './event.service'
import type { AuthenticatedUser } from '../types/request'
import type { TicketTypeInput } from '../repositories/ticket-type.repository'
import type { TicketTypeView } from '../types/event'

export async function createOrganizerTicketType(user: AuthenticatedUser, eventId: string, input: TicketTypeInput): Promise<TicketTypeView> {
  await getOwnedEvent(eventId, user)
  validateSalesWindow(input.salesStartAt, input.salesEndAt)
  return createTicketType(eventId, input)
}

export async function getTicketTypesForUser(eventId: string, user?: AuthenticatedUser): Promise<TicketTypeView[]> {
  const event = await getOwnedEventOrPublished(eventId, user)
  return listTicketTypes(event.id)
}

export async function updateOrganizerTicketType(user: AuthenticatedUser, eventId: string, ticketTypeId: string, input: Partial<TicketTypeInput>): Promise<TicketTypeView> {
  await getOwnedEvent(eventId, user)
  const existing = await findTicketType(ticketTypeId)
  if (!existing || existing.event_id !== eventId) throw new AppError(404, 'NOT_FOUND', 'Ticket type not found')
  const salesStartAt = input.salesStartAt === undefined ? existing.sales_start_at : input.salesStartAt
  const salesEndAt = input.salesEndAt === undefined ? existing.sales_end_at : input.salesEndAt
  validateSalesWindow(salesStartAt, salesEndAt)
  const updated = await updateTicketType(ticketTypeId, {
    name: input.name ?? existing.name,
    description: input.description === undefined ? existing.description : input.description,
    price: input.price ?? Number(existing.price),
    quantity: input.quantity ?? existing.quantity,
    salesStartAt,
    salesEndAt,
  })
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Ticket type not found')
  return updated
}

export async function deleteOrganizerTicketType(user: AuthenticatedUser, eventId: string, ticketTypeId: string): Promise<void> {
  await getOwnedEvent(eventId, user)
  const existing = await findTicketType(ticketTypeId)
  if (!existing || existing.event_id !== eventId) throw new AppError(404, 'NOT_FOUND', 'Ticket type not found')
  if (!(await deleteTicketType(ticketTypeId))) throw new AppError(404, 'NOT_FOUND', 'Ticket type not found')
}

async function getOwnedEventOrPublished(eventId: string, user?: AuthenticatedUser) {
  const event = await import('../repositories/event.repository').then(({ findEventById }) => findEventById(eventId))
  if (!event || (event.status !== 'published' && (!user || (user.role !== 'admin' && event.organizer_id !== user.id)))) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found')
  }
  return event
}

function validateSalesWindow(start?: string | null, end?: string | null): void {
  if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'sales_end_at must be later than sales_start_at')
  }
}
