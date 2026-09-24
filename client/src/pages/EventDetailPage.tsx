import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getEvent } from '../services/event.service'
import { listTicketTypes, createOrder } from '../services/order.service'
import type { Event } from '../types/event'
import type { TicketType } from '../types/order'

export function EventDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { accessToken, isAuthenticated } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const eventId = id ?? ''

  useEffect(() => {
    if (!eventId) return
    async function load(): Promise<void> {
      setLoading(true)
      setError('')
      try {
        const [eventResult, ticketResult] = await Promise.all([
          getEvent(eventId, accessToken ?? undefined),
          listTicketTypes(eventId, accessToken ?? undefined),
        ])
        setEvent(eventResult)
        setTicketTypes(ticketResult.data)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load event details')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [accessToken, eventId])

  const selectedItems = useMemo(() => ticketTypes
    .map((ticketType) => ({ ticketType, quantity: selectedQuantities[ticketType.id] ?? 0 }))
    .filter(({ quantity }) => quantity > 0), [selectedQuantities, ticketTypes])

  const total = useMemo(() => selectedItems.reduce((sum, { ticketType, quantity }) => {
    const unitPrice = Number(ticketType.price)
    return sum + (Number.isFinite(unitPrice) ? unitPrice * quantity : 0)
  }, 0), [selectedItems])

  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string; orderId: string } | null>(null)
  const { switchDemoRole } = useAuth()

  async function handleSubmit(): Promise<void> {
    if (!event || !selectedItems.length) {
      setError('Select at least one ticket to continue.')
      return
    }
    if (!accessToken) {
      navigate('/login', { state: { from: `/events/${event.id}` } })
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const payload = selectedItems.map(({ ticketType, quantity }) => ({ ticketTypeId: ticketType.id, quantity }))
      const order = await createOrder(payload, accessToken, crypto.randomUUID())
      setOrderSuccess({ orderNumber: order.order.order_number, orderId: order.order.id })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create order')
    } finally {
      setSubmitting(false)
    }
  }

  function handleIncrement(ticketTypeId: string, maxQty: number) {
    setSelectedQuantities((prev) => {
      const current = prev[ticketTypeId] ?? 0
      if (current >= maxQty) return prev
      return { ...prev, [ticketTypeId]: current + 1 }
    })
  }

  function handleDecrement(ticketTypeId: string) {
    setSelectedQuantities((prev) => {
      const current = prev[ticketTypeId] ?? 0
      if (current <= 0) return prev
      return { ...prev, [ticketTypeId]: current - 1 }
    })
  }

  if (loading) {
    return (
      <div className="event-detail-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading event information & seating tiers...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="event-detail-page">
        <div className="empty-state">
          <span className="empty-icon">❌</span>
          <h3>Event not found</h3>
          <p className="muted">The requested event could not be located or may have been unlisted.</p>
          <Link to="/events" className="btn-primary">Browse All Events</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="event-detail-page">
      <div className="detail-breadcrumb">
        <Link to="/events" className="breadcrumb-back">← Back to events</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{event.title}</span>
      </div>

      {/* Header Banner */}
      <div className="detail-hero-banner">
        <div className="detail-hero-badges">
          <span className="detail-status-pill">🟢 Live Booking</span>
          <span className="detail-venue-pill">📍 {event.venue?.city ?? 'Virtual Online'}</span>
        </div>
        <h1 className="detail-title">{event.title}</h1>
        <div className="detail-dates-bar">
          <div className="date-block">
            <span className="date-label">START DATE & TIME</span>
            <span className="date-value">{formatDate(event.start_at)}</span>
          </div>
          <div className="date-block-separator">→</div>
          <div className="date-block">
            <span className="date-label">END DATE & TIME</span>
            <span className="date-value">{formatDate(event.end_at)}</span>
          </div>
        </div>
      </div>

      <div className="detail-grid-layout">
        {/* Left Column: Details & Tiers */}
        <div className="detail-main-col">
          <section className="detail-card">
            <h2 className="detail-card-heading">About This Experience</h2>
            <p className="detail-description">{event.description || 'No detailed description provided for this event.'}</p>

            <div className="detail-highlights">
              <div className="highlight-item">
                <span className="highlight-icon">🏢</span>
                <div>
                  <strong>Venue Location</strong>
                  <p className="muted">{event.venue ? `${event.venue.name}, ${event.venue.address}, ${event.venue.city}, ${event.venue.country}` : 'Online Live Stream (Access token provided on booking)'}</p>
                </div>
              </div>
              <div className="highlight-item">
                <span className="highlight-icon">🎟️</span>
                <div>
                  <strong>Digital Admission Pass</strong>
                  <p className="muted">Instant QR-code issuance for contactless venue check-in.</p>
                </div>
              </div>
              <div className="highlight-item">
                <span className="highlight-icon">⚡</span>
                <div>
                  <strong>Organizer</strong>
                  <p className="muted">{event.organizer_name || 'Eventora Official'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Tickets Section */}
          <section className="detail-card">
            <h2 className="detail-card-heading">Select Admission Tier</h2>
            {ticketTypes.length ? (
              <div className="ticket-tiers-list">
                {ticketTypes.map((ticketType) => {
                  const maxAvailable = Math.max(0, Number(ticketType.quantity) - Number(ticketType.quantity_sold))
                  const selectedQty = selectedQuantities[ticketType.id] ?? 0

                  return (
                    <div key={ticketType.id} className={`ticket-tier-card ${selectedQty > 0 ? 'selected' : ''}`}>
                      <div className="tier-info">
                        <div className="tier-header-line">
                          <h3 className="tier-name">{ticketType.name}</h3>
                          <span className="tier-price">{formatMoney(ticketType.price)}</span>
                        </div>
                        <p className="tier-desc">{ticketType.description || 'General tier access and admission.'}</p>
                        <span className="tier-stock-badge">
                          {maxAvailable > 50 ? `${maxAvailable} passes remaining` : `Selling Fast! Only ${maxAvailable} left`}
                        </span>
                      </div>

                      <div className="tier-stepper">
                        <button
                          type="button"
                          className="stepper-btn"
                          onClick={() => handleDecrement(ticketType.id)}
                          disabled={selectedQty <= 0}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="stepper-value">{selectedQty}</span>
                        <button
                          type="button"
                          className="stepper-btn"
                          onClick={() => handleIncrement(ticketType.id, maxAvailable)}
                          disabled={selectedQty >= maxAvailable}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="muted">No ticket tiers currently active for this event.</p>
            )}
          </section>
        </div>

        {/* Right Column: Checkout Summary Card */}
        <div className="detail-sidebar-col">
          <div className="checkout-summary-card">
            <h3 className="summary-title">Booking Summary</h3>

            {selectedItems.length ? (
              <div className="summary-items-list">
                {selectedItems.map(({ ticketType, quantity }) => (
                  <div key={ticketType.id} className="summary-tier-row">
                    <div>
                      <span className="summary-tier-name">{ticketType.name}</span>
                      <span className="summary-tier-sub">Qty: {quantity} × {formatMoney(ticketType.price)}</span>
                    </div>
                    <span className="summary-tier-price">
                      {formatMoney((Number(ticketType.price) * quantity).toString())}
                    </span>
                  </div>
                ))}

                <div className="summary-divider"></div>

                <div className="summary-calc-row">
                  <span className="muted">Digital Delivery</span>
                  <span className="free-badge">FREE</span>
                </div>
                <div className="summary-calc-row">
                  <span className="muted">Platform Fee</span>
                  <span className="free-badge">WAIVED ($0.00)</span>
                </div>

                <div className="summary-divider"></div>

                <div className="summary-total-row">
                  <span>Grand Total</span>
                  <span className="grand-total-amount">{formatMoney(total.toFixed(2))}</span>
                </div>

                {isAuthenticated ? (
                  <button
                    type="button"
                    className="btn-checkout-primary"
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                  >
                    {submitting ? 'Confirming Reservation...' : 'Complete Reservation →'}
                  </button>
                ) : (
                  <div className="guest-checkout-box">
                    <p className="guest-hint">Sign in to complete booking:</p>
                    <button
                      type="button"
                      className="btn-demo-quick-login"
                      onClick={() => {
                        switchDemoRole('attendee')
                      }}
                    >
                      ⚡ 1-Click Sign in as Alex (Attendee)
                    </button>
                    <Link to="/login" state={{ from: `/events/${event.id}` }} className="link-standard-login">
                      Or sign in with existing credentials
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-cart-hint">
                <span className="cart-hint-icon">🎟️</span>
                <p>Select tickets from the admission tiers on the left to proceed with booking.</p>
              </div>
            )}

            {error ? <div className="alert-error" role="alert">{error}</div> : null}
          </div>
        </div>
      </div>

      {/* Order Confirmation Modal */}
      {orderSuccess && (
        <div className="modal-overlay">
          <div className="modal-dialog celebration-modal">
            <div className="modal-icon-circle">🎉</div>
            <h2 className="modal-title">Booking Confirmed!</h2>
            <p className="modal-subtitle">
              Your reservation <strong>{orderSuccess.orderNumber}</strong> has been secured and confirmed.
            </p>

            <div className="modal-ticket-preview">
              <span className="preview-label">EVENT PASS READY</span>
              <p className="preview-event-name">{event.title}</p>
              <div className="preview-qr-box">
                <span className="qr-simulated-code">🎟️ QR TOKEN ISSUED</span>
                <span className="preview-venue">{event.venue?.city ?? 'Online Stream'}</span>
              </div>
            </div>

            <div className="modal-actions">
              <Link to="/tickets" className="btn-modal-primary">
                View My Tickets & QR Pass →
              </Link>
              <button
                type="button"
                className="btn-modal-secondary"
                onClick={() => {
                  setOrderSuccess(null)
                  navigate('/orders')
                }}
              >
                Go to Orders
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatMoney(value: string | number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value))
}
