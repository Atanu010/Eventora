export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed'

export interface Venue {
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

export interface Event {
  id: string
  organizer_id: string
  organizer_name: string
  venue_id: string | null
  venue: Venue | null
  title: string
  slug: string
  description: string | null
  status: EventStatus
  start_at: string
  end_at: string
  created_at: string
  updated_at: string
}

export interface EventListResponse {
  data: Event[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}
