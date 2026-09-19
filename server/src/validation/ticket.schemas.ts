import { z } from 'zod'

export const checkInSchema = z.object({
  qrToken: z.string().trim().min(1).max(500),
})