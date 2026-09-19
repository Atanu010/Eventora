import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notification.service'

const idSchema = z.object({ id: z.string().uuid() })
const querySchema = z.object({ unread: z.enum(['true', 'false']).optional() })

export async function list(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const query = querySchema.parse(request.query)
    response.json({ data: await listNotifications(request.authUser!.id, query.unread === 'true') })
  } catch (error) { next(error) }
}

export async function markRead(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const found = await markNotificationRead(request.authUser!.id, idSchema.parse(request.params).id)
    if (!found) { response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } }); return }
    response.status(204).send()
  } catch (error) { next(error) }
}

export async function markAllRead(request: Request, response: Response, next: NextFunction): Promise<void> {
  try { response.json({ updated: await markAllNotificationsRead(request.authUser!.id) }) } catch (error) { next(error) }
}