import { useEffect, useState } from 'react'
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

  return (
    <section>
      <h2>My tickets</h2>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {loading ? <p>Loading tickets...</p> : null}
      {!loading && tickets.length === 0 ? <p className="muted">No tickets yet.</p> : null}
      <div className="list-stack">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="list-card">
            <p><strong>{ticket.ticket_number}</strong></p>
            <p>{ticket.event_title}</p>
            <p>Status: {ticket.status}</p>
            <p>Issued: {formatDate(ticket.issued_at)}</p>
            <p>QR: {ticket.qr_token ? ticket.qr_token.slice(0, 12) + '…' : 'Unavailable'}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
