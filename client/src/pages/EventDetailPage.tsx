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

  async function handleSubmit(): Promise<void> {
    if (!event || !selectedItems.length) {
      setError('Select at least one ticket.')
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
      navigate('/orders', { state: { createdOrderId: order.order.id, message: `Order ${order.order.order_number} created. Payment status: ${order.order.payment_status}.` } })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create order')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <section><h2>Event</h2><p>Loading event details...</p></section>
  if (!event) return <section><h2>Event</h2><p className="error">Event not found.</p></section>

  return (
    <section>
      <Link to="/events">← Back to events</Link>
      <h2>{event.title}</h2>
      <p>{event.description || 'No description provided.'}</p>
      <p className="muted">{formatDate(event.start_at)} to {formatDate(event.end_at)}</p>
      {event.venue ? <p>{event.venue.name} · {event.venue.city}</p> : <p className="muted">Venue details unavailable</p>}

      {ticketTypes.length ? (
        <div>
          <h3>Tickets</h3>
          {ticketTypes.map((ticketType) => (
            <div key={ticketType.id} className="ticket-row">
              <div>
                <strong>{ticketType.name}</strong>
                <p className="muted">{ticketType.description || 'No description.'}</p>
                <p>Price: {formatMoney(ticketType.price)}</p>
              </div>
              <label>
                Quantity
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, Number(ticketType.quantity) - Number(ticketType.quantity_sold))}
                  value={selectedQuantities[ticketType.id] ?? 0}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value)
                    setSelectedQuantities((current) => ({ ...current, [ticketType.id]: Number.isFinite(nextValue) ? Math.max(0, Math.min(nextValue, Number(ticketType.quantity) - Number(ticketType.quantity_sold))) : 0 }))
                  }}
                />
              </label>
            </div>
          ))}

          {selectedItems.length ? (
            <div className="order-summary-box">
              <h4>Order summary</h4>
              {selectedItems.map(({ ticketType, quantity }) => (
                <div key={ticketType.id} className="summary-line">
                  <span>{ticketType.name} × {quantity}</span>
                  <span>{formatMoney((Number(ticketType.price) * quantity).toString())}</span>
                </div>
              ))}
              <div className="summary-line total-row">
                <strong>Total</strong>
                <strong>{formatMoney(total.toFixed(2))}</strong>
              </div>
            </div>
          ) : null}

          {isAuthenticated ? (
            <button type="button" onClick={() => void handleSubmit()} disabled={submitting || !selectedItems.length}>
              {submitting ? 'Creating order...' : 'Create order'}
            </button>
          ) : (
            <p className="muted">Sign in to purchase tickets.</p>
          )}
        </div>
      ) : (
        <p className="muted">No ticket types are currently available for this event.</p>
      )}

      {error ? <p className="error" role="alert">{error}</p> : null}
    </section>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatMoney(value: string | number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value))
}
