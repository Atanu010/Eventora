export interface TicketType {
  id: string
  event_id: string
  name: string
  description: string | null
  price: string
  quantity: number
  quantity_sold: number
  sales_start_at: string | null
  sales_end_at: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  ticket_type_id: string
  event_id: string
  event_title: string
  quantity: number
  unit_price: string
  subtotal: string
}

export interface Order {
  id: string
  user_id: string
  order_number: string
  status: string
  payment_status: string
  total_amount: string
  currency: string
  expires_at: string
  items: OrderItem[]
}

export interface Ticket {
  id: string
  order_item_id: string
  ticket_type_id: string
  event_id: string
  event_title: string
  user_id: string
  ticket_number: string
  qr_token: string
  status: string
  issued_at: string
  used_at: string | null
  created_at: string
  updated_at: string
}
