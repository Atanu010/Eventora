import type { Event, EventListResponse } from '../types/event'
import type { TicketType, Order, Ticket } from '../types/order'
import type { AuthUser } from '../types/auth'
import type { DashboardSummary } from '../services/dashboard.service'

const STORAGE_KEY = 'eventora_demo_data_v1'

export interface DemoNotification {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  status: 'pending' | 'delivered' | 'failed'
  read_at: string | null
  created_at: string
}

export interface DemoState {
  events: Event[]
  ticketTypes: Record<string, TicketType[]>
  orders: Order[]
  tickets: Ticket[]
  notifications: DemoNotification[]
  checkInHistory: Array<{
    ticketNumber: string
    eventTitle: string
    attendeeName: string
    checkedInAt: string
    ticketType: string
  }>
}

export const DEMO_USERS: Record<string, AuthUser> = {
  attendee: {
    id: 'usr-attendee-001',
    name: 'Alex Johnson',
    email: 'alex@example.com',
    role: 'attendee',
  },
  organizer: {
    id: 'usr-organizer-001',
    name: 'Elena Rostova',
    email: 'elena@eventora.io',
    role: 'organizer',
  },
  admin: {
    id: 'usr-admin-001',
    name: 'Marcus Chen',
    email: 'admin@eventora.io',
    role: 'admin',
  },
}

const INITIAL_EVENTS: Event[] = [
  {
    id: 'evt-tech-summit-2026',
    organizer_id: 'usr-organizer-001',
    organizer_name: 'Elena Rostova',
    venue_id: 'ven-1',
    venue: {
      id: 'ven-1',
      name: 'Moscone Convention Center',
      address: '747 Howard St',
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
      postal_code: '94103',
      latitude: '37.784',
      longitude: '-122.401',
    },
    title: 'Global Tech & AI Summit 2026',
    slug: 'global-tech-ai-summit-2026',
    description: 'Join 5,000+ industry pioneers exploring generative agents, quantum computing breakthroughs, and autonomous systems. Featuring 40+ keynote speakers and interactive workshops.',
    status: 'published',
    start_at: new Date(Date.now() + 86400000 * 12).toISOString(),
    end_at: new Date(Date.now() + 86400000 * 14).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'evt-indie-music-fest',
    organizer_id: 'usr-organizer-001',
    organizer_name: 'Elena Rostova',
    venue_id: 'ven-2',
    venue: {
      id: 'ven-2',
      name: 'Sunset Waterfront Amphitheatre',
      address: '240 Waterfront Way',
      city: 'Austin',
      state: 'TX',
      country: 'USA',
      postal_code: '78701',
      latitude: '30.267',
      longitude: '-97.743',
    },
    title: 'Neon Waves Indie Music Festival',
    slug: 'neon-waves-indie-music-festival',
    description: 'A 2-day outdoor soundscape celebrating cutting-edge synth-pop, post-rock, and electronic live acts across three immersive lakeside stages.',
    status: 'published',
    start_at: new Date(Date.now() + 86400000 * 18).toISOString(),
    end_at: new Date(Date.now() + 86400000 * 20).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'evt-design-conference',
    organizer_id: 'usr-organizer-001',
    organizer_name: 'Elena Rostova',
    venue_id: 'ven-3',
    venue: {
      id: 'ven-3',
      name: 'The Barbican Centre',
      address: 'Silk St',
      city: 'London',
      state: null,
      country: 'UK',
      postal_code: 'EC2Y 8DS',
      latitude: '51.520',
      longitude: '-0.093',
    },
    title: 'Design Horizons: Product & Brand 2026',
    slug: 'design-horizons-product-brand-2026',
    description: 'Leading product designers, creative directors, and brand architects unpack the future of spatial UI, human-centered motion, and adaptive typography.',
    status: 'published',
    start_at: new Date(Date.now() + 86400000 * 25).toISOString(),
    end_at: new Date(Date.now() + 86400000 * 27).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'evt-culinary-masterclass',
    organizer_id: 'usr-organizer-001',
    organizer_name: 'Elena Rostova',
    venue_id: 'ven-4',
    venue: {
      id: 'ven-4',
      name: 'Atelier Kitchen Studio',
      address: '15 Mercer Street',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      postal_code: '10013',
      latitude: '40.720',
      longitude: '-74.000',
    },
    title: 'Modern Gastronomy & Wine Masterclass',
    slug: 'modern-gastronomy-wine-masterclass',
    description: 'Intimate tasting sessions and culinary technique demonstrations guided by Michelin-starred guest chefs and master sommeliers.',
    status: 'published',
    start_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    end_at: new Date(Date.now() + 86400000 * 7 + 14400000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'evt-city-marathon',
    organizer_id: 'usr-organizer-001',
    organizer_name: 'Elena Rostova',
    venue_id: 'ven-5',
    venue: {
      id: 'ven-5',
      name: 'Central Promenade',
      address: 'Ocean Parkway',
      city: 'Chicago',
      state: 'IL',
      country: 'USA',
      postal_code: '60601',
      latitude: '41.878',
      longitude: '-87.629',
    },
    title: 'Eventora City Half Marathon & 10K',
    slug: 'eventora-city-half-marathon-10k',
    description: 'Run through iconic scenic bridges and riverfront trails. Includes custom bib, finisher medal, timing chip, and post-race festival access.',
    status: 'published',
    start_at: new Date(Date.now() + 86400000 * 30).toISOString(),
    end_at: new Date(Date.now() + 86400000 * 30 + 21600000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'evt-web3-hackathon',
    organizer_id: 'usr-organizer-001',
    organizer_name: 'Elena Rostova',
    venue_id: null,
    venue: null,
    title: 'Virtual Global Hackathon: Autonomous Web',
    slug: 'virtual-global-hackathon-autonomous-web',
    description: '48 hours of intense coding, mentorship, and \$50,000 in bounties. Build AI-driven protocols, distributed apps, and zero-knowledge tools entirely online.',
    status: 'published',
    start_at: new Date(Date.now() + 86400000 * 5).toISOString(),
    end_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

const INITIAL_TICKET_TYPES: Record<string, TicketType[]> = {
  'evt-tech-summit-2026': [
    {
      id: 'tt-tech-general',
      event_id: 'evt-tech-summit-2026',
      name: 'General Admission',
      description: 'Access to main keynotes, exhibition floor, and evening mixer.',
      price: '199.00',
      quantity: 1500,
      quantity_sold: 840,
      sales_start_at: null,
      sales_end_at: null,
    },
    {
      id: 'tt-tech-vip',
      event_id: 'evt-tech-summit-2026',
      name: 'VIP & Speaker Lounge',
      description: 'Front-row stage seating, private VIP lounge, catered lunch, and backstage meet & greet.',
      price: '499.00',
      quantity: 250,
      quantity_sold: 195,
      sales_start_at: null,
      sales_end_at: null,
    },
  ],
  'evt-indie-music-fest': [
    {
      id: 'tt-music-single',
      event_id: 'evt-indie-music-fest',
      name: 'Single Day Pass',
      description: 'Standard access for Day 1 or Day 2 stages.',
      price: '79.00',
      quantity: 2000,
      quantity_sold: 1200,
      sales_start_at: null,
      sales_end_at: null,
    },
    {
      id: 'tt-music-weekend',
      event_id: 'evt-indie-music-fest',
      name: 'Full Weekend Pass',
      description: 'Both days unlimited re-entry plus festival merchandise tote.',
      price: '139.00',
      quantity: 1000,
      quantity_sold: 720,
      sales_start_at: null,
      sales_end_at: null,
    },
  ],
  'evt-design-conference': [
    {
      id: 'tt-design-early',
      event_id: 'evt-design-conference',
      name: 'Conference Pass',
      description: 'Full conference access and digital recordings of all tracks.',
      price: '249.00',
      quantity: 500,
      quantity_sold: 310,
      sales_start_at: null,
      sales_end_at: null,
    },
  ],
  'evt-culinary-masterclass': [
    {
      id: 'tt-culinary-tasting',
      event_id: 'evt-culinary-masterclass',
      name: 'Chef Table & Wine Pairing',
      description: 'Multi-course tasting menu paired with curated reserve vintages.',
      price: '185.00',
      quantity: 40,
      quantity_sold: 28,
      sales_start_at: null,
      sales_end_at: null,
    },
  ],
  'evt-city-marathon': [
    {
      id: 'tt-marathon-half',
      event_id: 'evt-city-marathon',
      name: 'Half Marathon (21.1K)',
      description: 'Includes timing chip, technical runner shirt, and finisher medal.',
      price: '65.00',
      quantity: 3000,
      quantity_sold: 2150,
      sales_start_at: null,
      sales_end_at: null,
    },
  ],
  'evt-web3-hackathon': [
    {
      id: 'tt-hack-free',
      event_id: 'evt-web3-hackathon',
      name: 'Free Hacker Registration',
      description: 'Online participant pass, mentor discord access, and prize submissions.',
      price: '0.00',
      quantity: 10000,
      quantity_sold: 4320,
      sales_start_at: null,
      sales_end_at: null,
    },
  ],
}

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-demo-101',
    user_id: 'usr-attendee-001',
    order_number: 'EVT-98210',
    status: 'completed',
    payment_status: 'paid',
    total_amount: '199.00',
    currency: 'USD',
    expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
    items: [
      {
        id: 'oi-demo-101',
        order_id: 'ord-demo-101',
        ticket_type_id: 'tt-tech-general',
        event_id: 'evt-tech-summit-2026',
        event_title: 'Global Tech & AI Summit 2026',
        quantity: 1,
        unit_price: '199.00',
        subtotal: '199.00',
      },
    ],
  },
]

const INITIAL_TICKETS: Ticket[] = [
  {
    id: 'tkt-demo-101',
    order_item_id: 'oi-demo-101',
    ticket_type_id: 'tt-tech-general',
    event_id: 'evt-tech-summit-2026',
    event_title: 'Global Tech & AI Summit 2026',
    user_id: 'usr-attendee-001',
    ticket_number: 'TCK-TECH-98210-A1',
    qr_token: 'QR_EVT_TECH_98210_VALID_TOKEN',
    status: 'valid',
    issued_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    used_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

const INITIAL_NOTIFICATIONS: DemoNotification[] = [
  {
    id: 'notif-1',
    type: 'order_confirmation',
    title: 'Order Confirmed: EVT-98210',
    body: 'Your ticket for Global Tech & AI Summit 2026 is confirmed. Pass ready for check-in.',
    data: { orderId: 'ord-demo-101' },
    status: 'delivered',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    read_at: null,
  },
  {
    id: 'notif-2',
    type: 'event_reminder',
    title: 'Reminder: Summit Venue & Schedule',
    body: 'Doors open at 8:30 AM at Moscone Convention Center. Have your QR token ready.',
    data: { eventId: 'evt-tech-summit-2026' },
    status: 'delivered',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    read_at: new Date().toISOString(),
  },
]

function getInitialState(): DemoState {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored) as DemoState
    } catch {
      // Fallback
    }
  }
  const state: DemoState = {
    events: INITIAL_EVENTS,
    ticketTypes: INITIAL_TICKET_TYPES,
    orders: INITIAL_ORDERS,
    tickets: INITIAL_TICKETS,
    notifications: INITIAL_NOTIFICATIONS,
    checkInHistory: [
      {
        ticketNumber: 'TCK-PREV-44102',
        eventTitle: 'Global Tech & AI Summit 2026',
        attendeeName: 'Sarah Connors',
        checkedInAt: new Date(Date.now() - 1800000).toISOString(),
        ticketType: 'VIP & Speaker Lounge',
      },
    ],
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  return state
}

let memoryState: DemoState = getInitialState()

function saveState(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState))
  } catch {
    // Ignore
  }
}

export function getDemoEvents(search?: string, city?: string): EventListResponse {
  let filtered = [...memoryState.events]
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter((e) => e.title.toLowerCase().includes(q) || (e.description && e.description.toLowerCase().includes(q)))
  }
  if (city) {
    const c = city.toLowerCase()
    filtered = filtered.filter((e) => e.venue && e.venue.city.toLowerCase().includes(c))
  }
  return {
    data: filtered,
    pagination: {
      page: 1,
      limit: 10,
      total: filtered.length,
      totalPages: 1,
    },
  }
}

export function getDemoEvent(id: string): Event {
  const event = memoryState.events.find((e) => e.id === id)
  if (!event) throw new Error('Event not found')
  return event
}

export function getDemoTicketTypes(eventId: string): TicketType[] {
  return memoryState.ticketTypes[eventId] ?? [
    {
      id: `tt-${eventId}-std`,
      event_id: eventId,
      name: 'Standard Admission',
      description: 'Standard access to the event proceedings.',
      price: '49.00',
      quantity: 500,
      quantity_sold: 120,
      sales_start_at: null,
      sales_end_at: null,
    },
  ]
}

export function createDemoOrder(items: Array<{ ticketTypeId: string; quantity: number }>, user: AuthUser): Order {
  let total = 0
  const orderItems = []
  const newTickets: Ticket[] = []
  const orderId = `ord-${Date.now().toString(36)}`
  const orderNumber = `EVT-${Math.floor(10000 + Math.random() * 90000)}`

  for (const item of items) {
    let matchedTicketType: TicketType | undefined
    let matchedEvent: Event | undefined
    for (const [eventId, tts] of Object.entries(memoryState.ticketTypes)) {
      const tt = tts.find((t) => t.id === item.ticketTypeId)
      if (tt) {
        matchedTicketType = tt
        matchedEvent = memoryState.events.find((e) => e.id === eventId)
        break
      }
    }

    const price = matchedTicketType ? Number(matchedTicketType.price) : 50
    const subtotal = price * item.quantity
    total += subtotal

    orderItems.push({
      id: `oi-${Math.random().toString(36).slice(2, 9)}`,
      order_id: orderId,
      ticket_type_id: item.ticketTypeId,
      event_id: matchedEvent?.id ?? 'evt-1',
      event_title: matchedEvent?.title ?? 'Featured Event',
      quantity: item.quantity,
      unit_price: price.toFixed(2),
      subtotal: subtotal.toFixed(2),
    })

    for (let i = 0; i < item.quantity; i++) {
      const ticketNum = `TCK-${Math.floor(100000 + Math.random() * 900000)}`
      newTickets.push({
        id: `tkt-${Math.random().toString(36).slice(2, 9)}`,
        order_item_id: orderId,
        ticket_type_id: item.ticketTypeId,
        event_id: matchedEvent?.id ?? 'evt-1',
        event_title: matchedEvent?.title ?? 'Featured Event',
        user_id: user.id,
        ticket_number: ticketNum,
        qr_token: `QR_${ticketNum}_TOKEN`,
        status: 'valid',
        issued_at: new Date().toISOString(),
        used_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
  }

  const order: Order = {
    id: orderId,
    user_id: user.id,
    order_number: orderNumber,
    status: 'completed',
    payment_status: 'paid',
    total_amount: total.toFixed(2),
    currency: 'USD',
    expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
    items: orderItems,
  }

  memoryState.orders.unshift(order)
  memoryState.tickets.unshift(...newTickets)
  memoryState.notifications.unshift({
    id: `notif-${Date.now()}`,
    type: 'order_confirmation',
    title: `Order Confirmed: ${orderNumber}`,
    body: `Your ticket purchase for ${orderItems[0]?.event_title ?? 'Event'} is confirmed!`,
    data: { orderId },
    status: 'delivered',
    created_at: new Date().toISOString(),
    read_at: null,
  })

  saveState()
  return order
}

export function getDemoOrders(): Order[] {
  return memoryState.orders
}

export function getDemoOrder(orderId: string): Order {
  const order = memoryState.orders.find((o) => o.id === orderId)
  if (!order) throw new Error('Order not found')
  return order
}

export function getDemoTickets(): Ticket[] {
  return memoryState.tickets
}

export function checkInDemoTicket(qrToken: string): {
  success: boolean
  alreadyCheckedIn: boolean
  ticketNumber: string
  eventTitle: string
  ticketType: string
  attendeeName: string
  checkedInAt: string
} {
  const ticket = memoryState.tickets.find((t) => t.qr_token === qrToken || t.ticket_number === qrToken)
  if (!ticket) {
    // If it's a simulated token not in array, simulate success for testing
    const simulated = {
      success: true,
      alreadyCheckedIn: false,
      ticketNumber: qrToken.startsWith('QR_') ? qrToken.replace('QR_', '').replace('_TOKEN', '') : qrToken,
      eventTitle: 'Global Tech & AI Summit 2026',
      ticketType: 'General Admission',
      attendeeName: 'Alex Johnson',
      checkedInAt: new Date().toISOString(),
    }
    memoryState.checkInHistory.unshift({
      ticketNumber: simulated.ticketNumber,
      eventTitle: simulated.eventTitle,
      attendeeName: simulated.attendeeName,
      checkedInAt: simulated.checkedInAt,
      ticketType: simulated.ticketType,
    })
    saveState()
    return simulated
  }

  if (ticket.status === 'used' || ticket.used_at) {
    return {
      success: false,
      alreadyCheckedIn: true,
      ticketNumber: ticket.ticket_number,
      eventTitle: ticket.event_title,
      ticketType: 'Admission Pass',
      attendeeName: 'Alex Johnson',
      checkedInAt: ticket.used_at ?? new Date().toISOString(),
    }
  }

  ticket.status = 'used'
  ticket.used_at = new Date().toISOString()
  const result = {
    success: true,
    alreadyCheckedIn: false,
    ticketNumber: ticket.ticket_number,
    eventTitle: ticket.event_title,
    ticketType: 'Admission Pass',
    attendeeName: 'Alex Johnson',
    checkedInAt: ticket.used_at,
  }
  memoryState.checkInHistory.unshift({
    ticketNumber: result.ticketNumber,
    eventTitle: result.eventTitle,
    attendeeName: result.attendeeName,
    checkedInAt: result.checkedInAt,
    ticketType: result.ticketType,
  })
  saveState()
  return result
}

export function getDemoCheckInHistory() {
  return memoryState.checkInHistory
}

export function getDemoNotifications(): DemoNotification[] {
  return memoryState.notifications
}

export function markDemoNotificationRead(id: string): void {
  const item = memoryState.notifications.find((n) => n.id === id)
  if (item) {
    item.read_at = new Date().toISOString()
    saveState()
  }
}

export function markAllDemoNotificationsRead(): void {
  for (const item of memoryState.notifications) {
    item.read_at = item.read_at ?? new Date().toISOString()
  }
  saveState()
}

export function getDemoDashboard(): DashboardSummary {
  const totalGross = memoryState.orders.reduce((sum, o) => sum + Number(o.total_amount), 142500)
  const ticketsSold = memoryState.tickets.length + 1840
  const ticketsCheckedIn = memoryState.checkInHistory.length + 940

  return {
    totals: {
      events: memoryState.events.length,
      publishedEvents: memoryState.events.length,
      grossRevenue: totalGross.toFixed(2),
      ticketsSold,
      ticketsCheckedIn,
      remainingInventory: 3420,
    },
    events: memoryState.events.map((evt, idx) => ({
      eventId: evt.id,
      title: evt.title,
      status: evt.status,
      startAt: evt.start_at,
      grossRevenue: (32000 - idx * 4500).toFixed(2),
      ticketsSold: 420 - idx * 50,
      ticketsCheckedIn: 280 - idx * 40,
      remainingInventory: 180 + idx * 30,
    })),
  }
}
