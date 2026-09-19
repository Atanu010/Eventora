export interface Page<T> { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface AdminDashboard { users: { total: number; organizers: number; attendees: number; admins: number }; events: { total: number; published: number; draft: number; cancelled: number }; orders: { total: number; confirmed: number; pending: number; cancelledOrRefunded: number }; tickets: { issued: number; checkedIn: number }; confirmedRevenue: string; recentActivity: Array<{ action: string; entity_type: string; entity_id: string | null; created_at: string }> }
export interface AdminUser { id: string; name: string; email: string; role: string; created_at: string; organizer_event_count?: number }
export interface AdminEvent { id: string; title: string; status: string; organizer_id: string; organizer_name: string; start_at: string; end_at: string; created_at: string }
export interface AdminOrder { id: string; order_number: string; status: string; payment_status: string; total_amount: string; currency: string; created_at: string; attendee_name: string; attendee_email: string; event_title: string; organizer_name: string; provider_order_id: string | null; provider_payment_id: string | null }
export interface AdminTicket { id: string; ticket_number: string; status: string; issued_at: string; used_at: string | null; event_title: string; organizer_name: string; attendee_name: string }
export interface AuditLog { id: string; admin_user_id: string; admin_name: string; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: string }

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } })
  const body = await response.json() as T | { error?: { message?: string } }
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } }
    throw new Error(errorBody.error?.message ?? 'Admin request failed')
  }
  return body as T
}
export const getAdminDashboard = (token: string) => request<AdminDashboard>('/api/admin/dashboard', token)
export const listUsers = (token: string, query: string) => request<Page<AdminUser>>(`/api/admin/users?${query}`, token)
export const changeRole = (token: string, id: string, role: string) => request<AdminUser>(`/api/admin/users/${id}/role`, token, { method: 'PATCH', body: JSON.stringify({ role }) })
export const listEvents = (token: string, query: string) => request<Page<AdminEvent>>(`/api/admin/events?${query}`, token)
export const moderateEvent = (token: string, id: string, status: string) => request<AdminEvent>(`/api/admin/events/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) })
export const listOrders = (token: string, query: string) => request<Page<AdminOrder>>(`/api/admin/orders?${query}`, token)
export const listTickets = (token: string, query: string) => request<Page<AdminTicket>>(`/api/admin/tickets?${query}`, token)
export const listAuditLogs = (token: string, query: string) => request<Page<AuditLog>>(`/api/admin/audit-logs?${query}`, token)
export const processAdminRefund = (token: string, orderId: string, idempotencyKey: string) => request<{ refund: { id: string; status: string; amount: string; currency: string } }>(`/api/admin/orders/${orderId}/refund`, token, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ reason: 'Admin-initiated refund' }) })