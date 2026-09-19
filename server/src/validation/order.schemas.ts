import { z } from 'zod'

export const createOrderSchema = z.object({
  items: z.array(z.object({
    ticketTypeId: z.string().uuid(),
    quantity: z.number().int().positive().max(20),
  })).min(1).max(20),
})

export const orderIdSchema = z.object({ id: z.string().uuid() })

export const ticketQuerySchema = z.object({
  event: z.string().uuid().optional(),
  status: z.enum(['active', 'used', 'cancelled']).optional(),
})
