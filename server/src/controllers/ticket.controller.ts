import type { NextFunction, Request, Response } from 'express'
import { checkInSchema } from '../validation/ticket.schemas'
import { checkInTicket } from '../services/ticket.service'

export async function checkIn(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { qrToken } = checkInSchema.parse(request.body)
    response.json(await checkInTicket(request.authUser!, qrToken))
  } catch (error) { next(error) }
}