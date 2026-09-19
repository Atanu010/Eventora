import type { Order, Ticket, TicketType } from '../types/order'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export function listTicketTypes(eventId: string, accessToken?: string): Promise<{ data: TicketType[] }> {
  return request(`/api/events/${eventId}/ticket-types`, accessToken)
}

export function createOrder(items: Array<{ ticketTypeId: string; quantity: number }>, accessToken: string, idempotencyKey: string): Promise<{ order: Order }> {
  return request('/api/orders', accessToken, { method: 'POST', body: JSON.stringify({ items }), headers: { 'Idempotency-Key': idempotencyKey } })
}

export function getOrder(orderId: string, accessToken: string): Promise<Order> {
  return request<Order>(`/api/orders/${orderId}`, accessToken)
}

export function listOrders(accessToken: string): Promise<{ data: Order[] }> {
  return request('/api/orders', accessToken)
}

export function listOrderTickets(orderId: string, accessToken: string): Promise<{ data: Ticket[] }> {
  return request(`/api/orders/${orderId}/tickets`, accessToken)
}

export function initializePayment(orderId: string, accessToken: string): Promise<{ orderId: string; razorpayOrderId: string; amount: number; currency: string; keyId: string }> {
  return request(`/api/payments/orders/${orderId}`, accessToken, { method: 'POST' })
}

export function verifyPayment(input: { orderId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }, accessToken: string): Promise<{ order: Order }> {
  return request('/api/payments/verify', accessToken, { method: 'POST', body: JSON.stringify(input) })
}

export function listTickets(accessToken: string): Promise<{ data: Ticket[] }> {
  return request('/api/tickets', accessToken)
}

export function checkInTicket(qrToken: string, accessToken: string): Promise<{
  success: boolean
  alreadyCheckedIn: boolean
  ticketNumber: string
  eventTitle: string
  ticketType: string
  attendeeName: string
  checkedInAt: string
}> {
  return request('/api/tickets/check-in', accessToken, { method: 'POST', body: JSON.stringify({ qrToken }) })
}

export interface Refund {
  id: string
  order_id: string
  payment_id: string
  provider: string
  provider_refund_id: string | null
  amount: string
  currency: string
  status: string
  reason: string | null
  idempotency_key: string
  created_at: string
  updated_at: string
}

export function listRefunds(orderId: string, accessToken: string): Promise<{ data: Refund[] }> {
  return request(`/api/orders/${orderId}/refunds`, accessToken)
}

export function requestRefund(orderId: string, accessToken: string, idempotencyKey: string, reason?: string): Promise<{ refund: Refund }> {
  return request(`/api/orders/${orderId}/refund`, accessToken, { method: 'POST', body: JSON.stringify({ reason }), headers: { 'Idempotency-Key': idempotencyKey } })
}

async function request<T>(path: string, accessToken?: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  })
  const body = await response.json() as T | { error?: { message?: string } }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body ? body.error?.message : undefined
    throw new Error(message ?? 'Order request failed')
  }
  return body as T
}
