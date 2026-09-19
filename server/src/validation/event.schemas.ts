import { z } from 'zod'

const eventStatus = z.enum(['draft', 'published', 'cancelled', 'completed'])
const timestamp = z.string().datetime({ offset: true })

const eventFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  venue_id: z.string().uuid().nullable().optional(),
  start_at: timestamp,
  end_at: timestamp,
}

export const createEventSchema = z.object({
  ...eventFields,
  status: z.literal('draft').optional(),
}).refine((value) => new Date(value.end_at).getTime() > new Date(value.start_at).getTime(), {
  path: ['end_at'],
  message: 'end_at must be later than start_at',
})

export const updateEventSchema = z.object({
  title: eventFields.title.optional(),
  description: eventFields.description,
  venue_id: eventFields.venue_id,
  start_at: eventFields.start_at.optional(),
  end_at: eventFields.end_at.optional(),
  status: eventStatus.optional(),
}).refine((value) => {
  if (!value.start_at || !value.end_at) return true
  return new Date(value.end_at).getTime() > new Date(value.start_at).getTime()
}, {
  path: ['end_at'],
  message: 'end_at must be later than start_at',
})

export const eventIdSchema = z.object({ id: z.string().uuid() })
export const eventParamSchema = z.object({ eventId: z.string().uuid() })
export const venueIdSchema = z.object({ id: z.string().uuid() })
export const eventAndTicketTypeIdSchema = z.object({
  eventId: z.string().uuid(),
  ticketTypeId: z.string().uuid(),
})

export const eventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: eventStatus.optional(),
  city: z.string().trim().max(100).optional(),
  start_date: timestamp.optional(),
  end_date: timestamp.optional(),
}).refine((value) => !value.start_date || !value.end_date || new Date(value.end_date).getTime() >= new Date(value.start_date).getTime(), {
  path: ['end_date'],
  message: 'end_date must not be earlier than start_date',
})

export const venueSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(300),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().min(1).max(100),
  postal_code: z.string().trim().max(30).nullable().optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
})

export const updateVenueSchema = venueSchema.partial()

const ticketTypeFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  price: z.coerce.number().finite().min(0).max(9999999999),
  quantity: z.coerce.number().int().min(0).max(2147483647),
  sales_start_at: timestamp.nullable().optional(),
  sales_end_at: timestamp.nullable().optional(),
}

const validTicketTypeWindow = <T extends { sales_start_at?: string | null; sales_end_at?: string | null }>(value: T) => !value.sales_start_at || !value.sales_end_at || new Date(value.sales_end_at).getTime() > new Date(value.sales_start_at).getTime()

export const createTicketTypeSchema = z.object(ticketTypeFields).refine(validTicketTypeWindow, {
  path: ['sales_end_at'],
  message: 'sales_end_at must be later than sales_start_at',
})

export const updateTicketTypeSchema = z.object(ticketTypeFields).partial().refine(validTicketTypeWindow, {
  path: ['sales_end_at'],
  message: 'sales_end_at must be later than sales_start_at',
})
