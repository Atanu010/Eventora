import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { listEvents } from '../services/event.service'
import type { Event } from '../types/event'

export function EventsPage() {
  const { accessToken } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true)
      setError('')
      try {
        const response = await listEvents(accessToken ?? undefined, { page, limit, search: search.trim() || undefined, city: city.trim() || undefined })
        setEvents(response.data)
        setTotalPages(response.pagination.totalPages)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load events')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [accessToken, city, limit, page, search])

  return (
    <section>
      <h2>Events</h2>
      <div className="filters">
        <input aria-label="Search events" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} placeholder="Search title or description" />
        <input aria-label="Filter by city" value={city} onChange={(event) => { setPage(1); setCity(event.target.value) }} placeholder="City" />
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {loading ? <p>Loading events...</p> : null}
      {!loading && events.length === 0 ? <p className="muted">No published events match your filters.</p> : null}
      <div className="event-list">
        {events.map((event) => (
          <Link key={event.id} to={`/events/${event.id}`} className="event-card">
            <strong>{event.title}</strong>
            <span>{formatDate(event.start_at)} · {event.venue?.city ?? 'Online'}</span>
            <span className="muted">{event.status}</span>
          </Link>
        ))}
      </div>
      {totalPages > 1 ? (
        <div className="pagination">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Previous</button>
          <span>Page {page} / {totalPages}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>Next</button>
        </div>
      ) : null}
    </section>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
