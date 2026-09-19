import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { changeUserRole, getAdminDashboard, getAdminEvent, getAdminUser, listAdminEvents, listAdminOrders, listAdminTickets, listAdminUsers, listAuditLogs, moderateEvent } from '../services/admin.service'

const pageSchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(100).default(20) })
const userRoleSchema = z.object({ role: z.enum(['attendee', 'organizer']) })
const eventStatusSchema = z.object({ status: z.enum(['draft', 'published', 'cancelled', 'completed']) })
const paramsSchema = z.object({ id: z.string().uuid() })
const query = (request: Request) => pageSchema.extend({ search: z.string().trim().optional(), role: z.enum(['attendee', 'organizer', 'admin']).optional(), status: z.string().optional(), organizerId: z.string().uuid().optional(), action: z.string().optional(), entityType: z.string().optional(), adminId: z.string().uuid().optional(), from: z.string().date().optional(), to: z.string().date().optional() }).parse(request.query)

export async function dashboard(_request: Request, response: Response, next: NextFunction): Promise<void> { try { response.json(await getAdminDashboard()) } catch (error) { next(error) } }
export async function users(request: Request, response: Response, next: NextFunction): Promise<void> { try { const q = query(request); response.json(await listAdminUsers(q.page, q.limit, q.search, q.role)) } catch (error) { next(error) } }
export async function user(request: Request, response: Response, next: NextFunction): Promise<void> { try { response.json(await getAdminUser(paramsSchema.parse(request.params).id)) } catch (error) { next(error) } }
export async function role(request: Request, response: Response, next: NextFunction): Promise<void> { try { response.json(await changeUserRole(request.authUser!, paramsSchema.parse(request.params).id, userRoleSchema.parse(request.body).role)) } catch (error) { next(error) } }
export async function events(request: Request, response: Response, next: NextFunction): Promise<void> { try { const q = query(request); response.json(await listAdminEvents(q.page, q.limit, q.search, q.status, q.organizerId)) } catch (error) { next(error) } }
export async function event(request: Request, response: Response, next: NextFunction): Promise<void> { try { response.json(await getAdminEvent(paramsSchema.parse(request.params).id)) } catch (error) { next(error) } }
export async function moderate(request: Request, response: Response, next: NextFunction): Promise<void> { try { response.json(await moderateEvent(request.authUser!, paramsSchema.parse(request.params).id, eventStatusSchema.parse(request.body).status)) } catch (error) { next(error) } }
export async function orders(request: Request, response: Response, next: NextFunction): Promise<void> { try { const q = query(request); response.json(await listAdminOrders(q.page, q.limit, q.search, q.status)) } catch (error) { next(error) } }
export async function tickets(request: Request, response: Response, next: NextFunction): Promise<void> { try { const q = query(request); response.json(await listAdminTickets(q.page, q.limit, q.search, q.status)) } catch (error) { next(error) } }
export async function auditLogs(request: Request, response: Response, next: NextFunction): Promise<void> { try { const q = query(request); response.json(await listAuditLogs(q.page, q.limit, q.action, q.entityType, q.adminId, q.from, q.to)) } catch (error) { next(error) } }