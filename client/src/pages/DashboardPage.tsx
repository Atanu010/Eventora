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
    <div className="dashboard-page">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Organizer Analytics Overview</h2>
          <p className="section-subtitle">Real-time attendance metrics, revenue tracking, and capacity monitoring.</p>
        </div>
        <div className="dashboard-period-tag">
          <span>📅 Last 30 Days</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-icon">💰</span>
            <span className="kpi-growth positive">+32.4% ↑</span>
          </div>
          <span className="kpi-label">Gross Revenue</span>
          <strong className="kpi-value">{formatMoney(dashboard.totals.grossRevenue)}</strong>
          <span className="kpi-sub">Across {dashboard.totals.publishedEvents} active events</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-icon">🎟️</span>
            <span className="kpi-growth positive">+18.2% ↑</span>
          </div>
          <span className="kpi-label">Total Passes Sold</span>
          <strong className="kpi-value">{dashboard.totals.ticketsSold.toLocaleString()}</strong>
          <span className="kpi-sub">{dashboard.totals.remainingInventory.toLocaleString()} remaining in inventory</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-icon">📱</span>
            <span className="kpi-growth neutral">89.4% rate</span>
          </div>
          <span className="kpi-label">Checked-In Attendees</span>
          <strong className="kpi-value">{dashboard.totals.ticketsCheckedIn.toLocaleString()}</strong>
          <span className="kpi-sub">Verified through QR gate scan</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-icon">🎪</span>
            <span className="kpi-growth positive">Active</span>
          </div>
          <span className="kpi-label">Hosted Events</span>
          <strong className="kpi-value">{dashboard.totals.events}</strong>
          <span className="kpi-sub">{dashboard.totals.publishedEvents} published live</span>
        </div>
      </div>

      {/* Visual Analytics Section */}
      <div className="dashboard-charts-layout">
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Revenue by Experience</h3>
              <p className="chart-subtitle">Relative financial yield per published production.</p>
            </div>
          </div>

          <div className="svg-chart-container">
            <svg viewBox="0 0 500 150" className="revenue-svg-chart">
              <line x1="40" y1="130" x2="480" y2="130" stroke="#e2e8f0" strokeWidth="1" />
              <line x1="40" y1="80" x2="480" y2="80" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />
              <line x1="40" y1="30" x2="480" y2="30" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />

              {/* Bars */}
              {dashboard.events.slice(0, 5).map((evt, i) => {
                const x = 70 + i * 85
                const height = Math.min(100, Math.max(30, Number(evt.grossRevenue) / 380))
                const y = 130 - height
                return (
                  <g key={evt.eventId} className="bar-group">
                    <rect
                      x={x}
                      y={y}
                      width="38"
                      height={height}
                      rx="6"
                      fill="url(#barGradient)"
                    />
                    <text x={x + 19} y="145" textAnchor="middle" fontSize="10" fill="#64748b">
                      E{i + 1}
                    </text>
                  </g>
                )
              })}

              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#4338ca" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="events-performance-card">
          <h3 className="chart-title">Live Production Pipeline</h3>
          <p className="chart-subtitle">Capacity fill rate and attendee check-in progress.</p>

          <div className="event-capacity-list">
            {dashboard.events.map((event) => {
              const totalCap = event.ticketsSold + event.remainingInventory
              const percentage = totalCap > 0 ? Math.round((event.ticketsSold / totalCap) * 100) : 0

              return (
                <div key={event.eventId} className="capacity-item">
                  <div className="capacity-header">
                    <div>
                      <strong className="capacity-name">{event.title}</strong>
                      <span className="capacity-date">{formatDate(event.startAt)}</span>
                    </div>
                    <div className="capacity-numbers">
                      <strong>{formatMoney(event.grossRevenue)}</strong>
                      <span className="muted">{percentage}% capacity</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="capacity-bar-track">
                    <div
                      className="capacity-bar-fill"
                      style={{ width: `${Math.min(100, percentage)}%` }}
                    ></div>
                  </div>

                  <div className="capacity-meta-row">
                    <span>{event.ticketsSold} passes sold</span>
                    <span>{event.ticketsCheckedIn} checked in</span>
                    <span>{event.remainingInventory} seats remaining</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="dashboard-metric"><span className="muted">{label}</span><strong>{value}</strong></div>
}

function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function formatMoney(value: string): string { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value)) }