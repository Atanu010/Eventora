import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getDashboardSummary } from '../services/dashboard.service'
import type { DashboardSummary } from '../services/dashboard.service'

export function DashboardPage() {
  const { accessToken } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken) return
    setLoading(true)
    void getDashboardSummary(accessToken)
      .then(setDashboard)
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard'))
      .finally(() => setLoading(false))
  }, [accessToken])

  if (loading) return <section><h2>Dashboard</h2><p>Loading dashboard...</p></section>
  if (error) return <section><h2>Dashboard</h2><p className="error" role="alert">{error}</p></section>
  if (!dashboard) return <section><h2>Dashboard</h2><p className="muted">Dashboard unavailable.</p></section>

  return (
    <section>
      <h2>Dashboard</h2>
      <div className="dashboard-metrics">
        <Metric label="Events" value={dashboard.totals.events} />
        <Metric label="Published" value={dashboard.totals.publishedEvents} />
        <Metric label="Revenue" value={formatMoney(dashboard.totals.grossRevenue)} />
        <Metric label="Tickets sold" value={dashboard.totals.ticketsSold} />
        <Metric label="Checked in" value={dashboard.totals.ticketsCheckedIn} />
        <Metric label="Inventory left" value={dashboard.totals.remainingInventory} />
      </div>
      <h3>Events</h3>
      {!dashboard.events.length ? <p className="muted">No events yet.</p> : null}
      <div className="list-stack">
        {dashboard.events.map((event) => (
          <article className="list-card" key={event.eventId}>
            <div className="summary-line"><strong>{event.title}</strong><span>{event.status}</span></div>
            <p className="muted">{formatDate(event.startAt)}</p>
            <p>Revenue: {formatMoney(event.grossRevenue)}</p>
            <p>Tickets: {event.ticketsSold} sold · {event.ticketsCheckedIn} checked in · {event.remainingInventory} remaining</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="dashboard-metric"><span className="muted">{label}</span><strong>{value}</strong></div>
}

function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function formatMoney(value: string): string { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value)) }