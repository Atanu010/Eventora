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

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function getDashboardSummary(accessToken: string): Promise<DashboardSummary> {
  const response = await fetch(`${apiUrl}/api/dashboard/summary`, { headers: { Authorization: `Bearer ${accessToken}` } })
  const body = await response.json() as DashboardSummary | { error?: { message?: string } }
  if (!response.ok) throw new Error('error' in body ? body.error?.message ?? 'Unable to load dashboard' : 'Unable to load dashboard')
  return body as DashboardSummary
}