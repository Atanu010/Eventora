export type OrderStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'refunded'
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded'
export type TicketStatus = 'active' | 'used' | 'cancelled'

export interface OrderItemView {
  id: string
  order_id: string
  ticket_type_id: string
  event_id: string
  event_title: string
  quantity: number
  unit_price: string
  subtotal: string
}

export interface OrderView {
  id: string
  user_id: string
  order_number: string
  status: OrderStatus
  payment_status: PaymentStatus
  total_amount: string
  currency: string
  expires_at: string
  created_at: string
  updated_at: string
  items: OrderItemView[]
}

export interface TicketView {
  id: string
  order_item_id: string
  ticket_type_id: string
  event_id: string
  event_title: string
  user_id: string
  ticket_number: string
  qr_token: string
  status: TicketStatus
  issued_at: string
  used_at: string | null
  created_at: string
  updated_at: string
}
