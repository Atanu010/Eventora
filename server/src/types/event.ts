export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed'

export interface EventView {
  id: string
  organizer_id: string
  organizer_name: string
  venue_id: string | null
  venue: VenueView | null
  title: string
  slug: string
  description: string | null
  status: EventStatus
  start_at: string
  end_at: string
  created_at: string
  updated_at: string
}

export interface VenueView {
  id: string
  name: string
  address: string
  city: string
  state: string | null
  country: string
  postal_code: string | null
  latitude: string | null
  longitude: string | null
}

export interface TicketTypeView {
  id: string
  event_id: string
  name: string
  description: string | null
  price: string
  quantity: number
  quantity_sold: number
  sales_start_at: string | null
  sales_end_at: string | null
  created_at: string
  updated_at: string
}
