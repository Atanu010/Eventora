import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { listTickets } from '../services/order.service'
import type { Ticket } from '../types/order'

export function TicketsPage() {
  const { accessToken } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load(): Promise<void> {
      if (!accessToken) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const response = await listTickets(accessToken)
        setTickets(response.data)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load tickets')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [accessToken])

  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  function handleCopyToken(token: string) {
    void navigator.clipboard.writeText(token)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2500)
  }

  return (
    <div className="tickets-page">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">My Digital Passes</h2>
          <p className="section-subtitle">Present your QR code pass at venue entrances for instant check-in.</p>
        </div>
        <Link to="/organizer/check-in" className="btn-secondary-sm">
          📱 Open Check-in Scanner
        </Link>
      </div>

      {error ? <div className="alert-error" role="alert">{error}</div> : null}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Retrieving your event passes...</p>
        </div>
      ) : null}

      {!loading && tickets.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🎟️</span>
          <h3>No tickets found</h3>
          <p className="muted">You have not booked any event passes yet.</p>
          <Link to="/events" className="btn-primary">Browse Events</Link>
        </div>
      ) : null}

      <div className="tickets-grid">
        {tickets.map((ticket) => {
          const isValid = ticket.status === 'valid'
          const isCopied = copiedToken === ticket.qr_token

          return (
            <div key={ticket.id} className={`digital-pass-card ${isValid ? 'valid' : 'used'}`}>
              <div className="pass-header">
                <div>
                  <span className="pass-brand">EVENTORA PASS</span>
                  <h3 className="pass-event-title">{ticket.event_title}</h3>
                </div>
                <span className={`pass-status-pill ${isValid ? 'status-valid' : 'status-used'}`}>
                  {isValid ? '🟢 VALID' : '⚪ CHECKED IN'}
                </span>
              </div>

              <div className="pass-body">
                <div className="pass-info-grid">
                  <div className="pass-info-item">
                    <span className="pass-label">PASS NUMBER</span>
                    <strong className="pass-val">{ticket.ticket_number}</strong>
                  </div>
                  <div className="pass-info-item">
                    <span className="pass-label">DATE ISSUED</span>
                    <span className="pass-val">{formatDate(ticket.issued_at)}</span>
                  </div>
                  <div className="pass-info-item">
                    <span className="pass-label">SEAT / TIER</span>
                    <span className="pass-val">General Admission</span>
                  </div>
                  <div className="pass-info-item">
                    <span className="pass-label">CHECK-IN STATUS</span>
                    <span className="pass-val">{ticket.used_at ? `Used at ${formatDate(ticket.used_at)}` : 'Ready to scan'}</span>
                  </div>
                </div>

                {/* Simulated QR Code Visual */}
                <div className="pass-qr-container">
                  <div className="simulated-qr-matrix">
                    <div className="qr-corner top-left"></div>
                    <div className="qr-corner top-right"></div>
                    <div className="qr-corner bottom-left"></div>
                    <div className="qr-pattern-lines">
                      <span>■ □ ■ ■ □ ■</span>
                      <span>□ ■ □ □ ■ □</span>
                      <span>■ ■ □ ■ ■ ■</span>
                      <span>□ □ ■ □ □ ■</span>
                    </div>
                  </div>
                  <div className="pass-qr-details">
                    <span className="qr-label">DIGITAL TOKEN</span>
                    <code className="qr-code-text">{ticket.qr_token || 'TOKEN-GEN-10293'}</code>
                    <button
                      type="button"
                      className="btn-copy-token"
                      onClick={() => handleCopyToken(ticket.qr_token)}
                    >
                      {isCopied ? '✓ Copied Token!' : '📋 Copy for Scanner'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pass-stub-perforation">
                <div className="cut-notch left"></div>
                <div className="cut-line"></div>
                <div className="cut-notch right"></div>
              </div>

              <div className="pass-footer">
                <span className="pass-security-hash">🔐 Encrypted Anti-Tamper NFC/QR ID</span>
                <span className="pass-instruction">Show at gate on mobile</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
