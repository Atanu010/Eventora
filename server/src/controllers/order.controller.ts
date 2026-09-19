import type { NextFunction, Request, Response } from 'express'
import { createOrderSchema, orderIdSchema, ticketQuerySchema } from '../validation/order.schemas'
import { cancelPendingOrder, createOrder, getOrder, getOrderTickets, getOrders, getTickets } from '../services/order.service'

export async function create(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const idempotencyKey = request.header('idempotency-key')?.trim()
    if (idempotencyKey && idempotencyKey.length > 100) {
      response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Idempotency-Key is too long' } })
      return
    }
    response.status(201).json({ order: await createOrder(request.authUser!, createOrderSchema.parse(request.body).items, idempotencyKey) })
  } catch (error) { next(error) }
}

export async function list(request: Request, response: Response, next: NextFunction): Promise<void> {
  try { response.json({ data: await getOrders(request.authUser!) }) } catch (error) { next(error) }
}

export async function getOne(request: Request, response: Response, next: NextFunction): Promise<void> {
  try { response.json(await getOrder(request.authUser!, orderIdSchema.parse(request.params).id)) } catch (error) { next(error) }
}

export async function tickets(request: Request, response: Response, next: NextFunction): Promise<void> {
  try { response.json({ data: await getOrderTickets(request.authUser!, orderIdSchema.parse(request.params).id) }) } catch (error) { next(error) }
}

export async function userTickets(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const query = ticketQuerySchema.parse(request.query)
    response.json({ data: await getTickets(request.authUser!, query.event, query.status) })
  } catch (error) { next(error) }
}

export async function cancel(request: Request, response: Response, next: NextFunction): Promise<void> {
  try { await cancelPendingOrder(request.authUser!, orderIdSchema.parse(request.params).id); response.status(204).send() } catch (error) { next(error) }
}
