import type { PoolClient } from 'pg'
import pool from '../config/database'
import { AppError } from '../utils/errors'
import { getOwnedEvent, updateOrganizerEvent } from './event.service'
import type { AuthenticatedUser } from '../types/request'
import type { AdminDashboard, AdminEventView, AdminOrderView, AdminTicketView, AdminUserView, AuditLogView } from '../types/admin'
import type { EventStatus } from '../types/event'

export interface Page<T> { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
const pageResult = <T>(data: T[], total: number, page: number, limit: number): Page<T> => ({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
const dateValue = (value: Date | string | null): string | null => value instanceof Date ? value.toISOString() : value

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [users, events, orders, tickets, revenue, activity] = await Promise.all([
    pool.query<{ role: string; count: string }>('SELECT role, COUNT(*)::text AS count FROM users GROUP BY role'),
    pool.query<{ status: string; count: string }>('SELECT status, COUNT(*)::text AS count FROM events GROUP BY status'),
    pool.query<{ status: string; count: string }>('SELECT status, COUNT(*)::text AS count FROM orders GROUP BY status'),
    pool.query<{ status: string; count: string }>('SELECT status, COUNT(*)::text AS count FROM tickets GROUP BY status'),
    pool.query<{ total: string }>("SELECT COALESCE(SUM(total_amount), 0)::numeric(12,2)::text AS total FROM orders WHERE status = 'confirmed' AND payment_status = 'paid'"),
    pool.query<{ action: string; entity_type: string; entity_id: string | null; created_at: Date | string }>('SELECT action, entity_type, entity_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20'),
  ])
  const count = (rows: Array<{ status?: string; role?: string; count: string }>, key: string): number => Number(rows.find((row) => (row.status ?? row.role) === key)?.count ?? 0)
  return {
    users: { total: users.rows.reduce((sum, row) => sum + Number(row.count), 0), organizers: count(users.rows, 'organizer'), attendees: count(users.rows, 'attendee'), admins: count(users.rows, 'admin') },
    events: { total: events.rows.reduce((sum, row) => sum + Number(row.count), 0), published: count(events.rows, 'published'), draft: count(events.rows, 'draft'), cancelled: count(events.rows, 'cancelled') },
    orders: { total: orders.rows.reduce((sum, row) => sum + Number(row.count), 0), confirmed: count(orders.rows, 'confirmed'), pending: count(orders.rows, 'pending'), cancelledOrRefunded: count(orders.rows, 'cancelled') + count(orders.rows, 'refunded') },
    tickets: { issued: tickets.rows.reduce((sum, row) => sum + Number(row.count), 0), checkedIn: count(tickets.rows, 'used') },
    confirmedRevenue: revenue.rows[0].total,
    recentActivity: activity.rows.map((row) => ({ ...row, created_at: dateValue(row.created_at)! })),
  }
}

export async function listAdminUsers(page: number, limit: number, search?: string, role?: string): Promise<Page<AdminUserView>> {
  const values: unknown[] = []; const conditions: string[] = []
  if (search) { values.push(`%${search}%`); conditions.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length})`) }
  if (role) { values.push(role); conditions.push(`u.role = $${values.length}`) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const count = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users u ${where}`, values)
  values.push(limit, (page - 1) * limit)
  const result = await pool.query<AdminUserView>(`SELECT u.id, u.name, u.email, u.role, u.created_at, CASE WHEN u.role = 'organizer' THEN (SELECT COUNT(*)::int FROM events e WHERE e.organizer_id = u.id) END AS organizer_event_count FROM users u ${where} ORDER BY u.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values)
  return pageResult(result.rows.map((row) => ({ ...row, created_at: dateValue(row.created_at)! })), Number(count.rows[0].count), page, limit)
}

export async function getAdminUser(id: string): Promise<AdminUserView> {
  const result = await pool.query<AdminUserView>('SELECT u.id, u.name, u.email, u.role, u.created_at, CASE WHEN u.role = \'organizer\' THEN (SELECT COUNT(*)::int FROM events e WHERE e.organizer_id = u.id) END AS organizer_event_count FROM users u WHERE u.id = $1', [id])
  if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'User not found')
  return { ...result.rows[0], created_at: dateValue(result.rows[0].created_at)! }
}

export async function changeUserRole(admin: AuthenticatedUser, id: string, role: 'attendee' | 'organizer'): Promise<AdminUserView> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const target = await client.query<{ id: string; role: string; name: string }>('SELECT id, role, name FROM users WHERE id = $1 FOR UPDATE', [id])
    if (!target.rows[0]) throw new AppError(404, 'NOT_FOUND', 'User not found')
    if (target.rows[0].role === 'admin') throw new AppError(422, 'ROLE_CHANGE_NOT_ALLOWED', 'Administrator roles cannot be changed here')
    await client.query('UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1', [id, role])
    await insertAudit(client, admin.id, 'ROLE_CHANGED', 'user', id, { from: target.rows[0].role, to: role })
    await client.query('COMMIT')
    return getAdminUser(id)
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function moderateEvent(admin: AuthenticatedUser, id: string, status: EventStatus): Promise<unknown> {
  const existing = await getOwnedEvent(id, admin)
  const updated = await updateOrganizerEvent(admin, id, { title: existing.title, description: existing.description, venue_id: existing.venue_id, start_at: existing.start_at, end_at: existing.end_at, status })
  await insertAuditOutsideTransaction(admin.id, `EVENT_${status.toUpperCase()}`, 'event', id, { from: existing.status, to: status })
  return updated
}

export async function listAdminEvents(page: number, limit: number, search?: string, status?: string, organizerId?: string): Promise<Page<AdminEventView>> {
  const values: unknown[] = []; const conditions: string[] = []
  if (search) { values.push(`%${search}%`); conditions.push(`(e.title ILIKE $${values.length} OR e.slug ILIKE $${values.length})`) }
  if (status) { values.push(status); conditions.push(`e.status = $${values.length}`) }
  if (organizerId) { values.push(organizerId); conditions.push(`e.organizer_id = $${values.length}`) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const count = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM events e ${where}`, values)
  values.push(limit, (page - 1) * limit)
  const rows = await pool.query<AdminEventView>(`SELECT e.id, e.title, e.status, e.organizer_id, u.name AS organizer_name, e.start_at, e.end_at, e.created_at FROM events e JOIN users u ON u.id = e.organizer_id ${where} ORDER BY e.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values)
  return pageResult(rows.rows.map((row) => ({ ...row, start_at: dateValue(row.start_at)!, end_at: dateValue(row.end_at)!, created_at: dateValue(row.created_at)! })), Number(count.rows[0].count), page, limit)
}

export async function getAdminEvent(id: string): Promise<AdminEventView> {
  const result = await pool.query<AdminEventView>('SELECT e.id, e.title, e.status, e.organizer_id, u.name AS organizer_name, e.start_at, e.end_at, e.created_at FROM events e JOIN users u ON u.id = e.organizer_id WHERE e.id = $1', [id])
  if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Event not found')
  const row = result.rows[0]
  return { ...row, start_at: dateValue(row.start_at)!, end_at: dateValue(row.end_at)!, created_at: dateValue(row.created_at)! }
}

export async function listAdminOrders(page: number, limit: number, search?: string, status?: string): Promise<Page<AdminOrderView>> {
  const values: unknown[] = []; const conditions: string[] = []
  if (search) { values.push(`%${search}%`); conditions.push(`(o.order_number ILIKE $${values.length} OR au.email ILIKE $${values.length} OR e.title ILIKE $${values.length})`) }
  if (status) { values.push(status); conditions.push(`o.status = $${values.length}`) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const count = await pool.query<{ count: string }>(`SELECT COUNT(DISTINCT o.id)::text AS count FROM orders o JOIN users au ON au.id = o.user_id LEFT JOIN order_items oi ON oi.order_id = o.id LEFT JOIN ticket_types tt ON tt.id = oi.ticket_type_id LEFT JOIN events e ON e.id = tt.event_id ${where}`, values)
  values.push(limit, (page - 1) * limit)
  const rows = await pool.query<AdminOrderView>(`SELECT o.id, o.order_number, o.status, o.payment_status, o.total_amount, o.currency, o.created_at, au.name AS attendee_name, au.email AS attendee_email, COALESCE(MAX(e.title), 'Unknown event') AS event_title, COALESCE(MAX(ou.name), 'Unknown organizer') AS organizer_name, MAX(p.provider_order_id) AS provider_order_id, MAX(p.provider_payment_id) AS provider_payment_id FROM orders o JOIN users au ON au.id = o.user_id LEFT JOIN order_items oi ON oi.order_id = o.id LEFT JOIN ticket_types tt ON tt.id = oi.ticket_type_id LEFT JOIN events e ON e.id = tt.event_id LEFT JOIN users ou ON ou.id = e.organizer_id LEFT JOIN payments p ON p.order_id = o.id ${where} GROUP BY o.id, au.name, au.email ORDER BY o.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values)
  return pageResult(rows.rows.map((row) => ({ ...row, created_at: dateValue(row.created_at)! })), Number(count.rows[0].count), page, limit)
}

export async function listAdminTickets(page: number, limit: number, search?: string, status?: string): Promise<Page<AdminTicketView>> {
  const values: unknown[] = []; const conditions: string[] = []
  if (search) { values.push(`%${search}%`); conditions.push(`(t.ticket_number ILIKE $${values.length} OR e.title ILIKE $${values.length} OR au.name ILIKE $${values.length})`) }
  if (status) { values.push(status); conditions.push(`t.status = $${values.length}`) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const count = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tickets t JOIN users au ON au.id = t.user_id JOIN ticket_types tt ON tt.id = t.ticket_type_id JOIN events e ON e.id = tt.event_id ${where}`, values)
  values.push(limit, (page - 1) * limit)
  const rows = await pool.query<AdminTicketView>(`SELECT t.id, t.ticket_number, t.status, t.issued_at, t.used_at, e.title AS event_title, ou.name AS organizer_name, au.name AS attendee_name FROM tickets t JOIN users au ON au.id = t.user_id JOIN ticket_types tt ON tt.id = t.ticket_type_id JOIN events e ON e.id = tt.event_id JOIN users ou ON ou.id = e.organizer_id ${where} ORDER BY t.issued_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values)
  return pageResult(rows.rows.map((row) => ({ ...row, issued_at: dateValue(row.issued_at)!, used_at: dateValue(row.used_at) })), Number(count.rows[0].count), page, limit)
}

export async function listAuditLogs(page: number, limit: number, action?: string, entityType?: string, adminId?: string, from?: string, to?: string): Promise<Page<AuditLogView>> {
  const values: unknown[] = []; const conditions: string[] = []
  if (action) { values.push(action); conditions.push(`a.action = $${values.length}`) }
  if (entityType) { values.push(entityType); conditions.push(`a.entity_type = $${values.length}`) }
  if (adminId) { values.push(adminId); conditions.push(`a.admin_user_id = $${values.length}`) }
  if (from) { values.push(from); conditions.push(`a.created_at >= $${values.length}`) }
  if (to) { values.push(to); conditions.push(`a.created_at < ($${values.length}::date + INTERVAL '1 day')`) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const count = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM audit_logs a ${where}`, values)
  values.push(limit, (page - 1) * limit)
  const rows = await pool.query<AuditLogView>(`SELECT a.id, COALESCE(a.actor_user_id, a.admin_user_id) AS admin_user_id, u.name AS admin_name, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at FROM audit_logs a JOIN users u ON u.id = COALESCE(a.actor_user_id, a.admin_user_id) ${where} ORDER BY a.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values)
  return pageResult(rows.rows.map((row) => ({ ...row, created_at: dateValue(row.created_at)! })), Number(count.rows[0].count), page, limit)
}

async function insertAudit(client: PoolClient, adminId: string, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>): Promise<void> {
  await client.query('INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)', [adminId, action, entityType, entityId, JSON.stringify(metadata)])
}
async function insertAuditOutsideTransaction(adminId: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>): Promise<void> {
  await pool.query('INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)', [adminId, action, entityType, entityId, JSON.stringify(metadata)])
}