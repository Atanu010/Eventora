export interface DashboardSummary {
  totals: {
    events: number
    publishedEvents: number
    grossRevenue: string
    ticketsSold: number
    ticketsCheckedIn: number
    remainingInventory: number
  }
  events: DashboardEvent[]
}

export interface DashboardEvent {
  eventId: string
  title: string
  status: string
  startAt: string
  ticketsSold: number
  ticketsCheckedIn: number
  remainingInventory: number
  grossRevenue: string
}