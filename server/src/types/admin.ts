export interface AdminDashboard {
  users: { total: number; organizers: number; attendees: number; admins: number }
  events: { total: number; published: number; draft: number; cancelled: number }
  orders: { total: number; confirmed: number; pending: number; cancelledOrRefunded: number }
  tickets: { issued: number; checkedIn: number }
  confirmedRevenue: string
  recentActivity: Array<{ action: string; entity_type: string; entity_id: string | null; created_at: string }>
}

export interface AdminUserView { id: string; name: string; email: string; role: string; created_at: string; organizer_event_count?: number }
export interface AdminEventView { id: string; title: string; status: string; organizer_id: string; organizer_name: string; start_at: string; end_at: string; created_at: string }
export interface AdminOrderView { id: string; order_number: string; status: string; payment_status: string; total_amount: string; currency: string; created_at: string; attendee_name: string; attendee_email: string; event_title: string; organizer_name: string; provider_order_id: string | null; provider_payment_id: string | null }
export interface AdminTicketView { id: string; ticket_number: string; status: string; issued_at: string; used_at: string | null; event_title: string; organizer_name: string; attendee_name: string }
export interface AuditLogView { id: string; admin_user_id: string; admin_name: string; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: string }