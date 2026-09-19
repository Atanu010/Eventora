import { z } from 'zod'

export const refundOrderIdSchema = z.object({ orderId: z.string().uuid() })
export const refundRequestSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().trim().max(500).optional(),
})