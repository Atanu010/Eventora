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
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const categories = ['All', 'Technology', 'Music', 'Design', 'Culinary', 'Sports']
  const popularCities = ['All', 'San Francisco', 'Austin', 'London', 'New York', 'Chicago']

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true)
      setError('')
      try {
        const querySearch = selectedCategory !== 'All' 
          ? (search ? `${search} ${selectedCategory}` : selectedCategory)
          : search
        const response = await listEvents(accessToken ?? undefined, {
          page,
          limit,
          search: querySearch.trim() || undefined,
          city: city && city !== 'All' ? city.trim() : undefined,
        })
        setEvents(response.data)
        setTotalPages(response.pagination.totalPages)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load events')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [accessToken, city, limit, page, search, selectedCategory])

  return (
    <div className="events-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">✨ Live Experiences Across the Globe</div>
          <h1 className="hero-title">
            Discover & Experience <span className="gradient-text">Extraordinary Events</span>
          </h1>
          <p className="hero-subtitle">
            Book passes for premier tech summits, open-air music festivals, design workshops, and culinary masterclasses.
          </p>

          {/* Search Box */}
          <div className="search-bar-wrap">
            <div className="search-input-group">
              <span className="search-icon">🔍</span>
              <input
                aria-label="Search events"
                value={search}
                onChange={(event) => {
                  setPage(1)
                  setSearch(event.target.value)
                }}
                placeholder="Search events by title, topic, or keynote..."
              />
              {search && (
                <button type="button" className="btn-clear-search" onClick={() => setSearch('')}>
                  ✕
                </button>
              )}
            </div>

            <div className="city-input-group">
              <span className="search-icon">📍</span>
              <select
                aria-label="Filter by city"
                value={city}
                onChange={(event) => {
                  setPage(1)
                  setCity(event.target.value)
                }}
              >
                {popularCities.map((c) => (
                  <option key={c} value={c === 'All' ? '' : c}>
                    {c === 'All' ? 'All Locations' : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Chips */}
          <div className="category-chips">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setPage(1)
                  setSelectedCategory(cat)
                }}
              >
                {getCategoryEmoji(cat)} {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Events Feed */}
      <section className="events-catalog-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Upcoming Events</h2>
            <p className="section-subtitle">
              {loading ? 'Finding events...' : `Showing ${events.length} curated events`}
            </p>
          </div>
          <div className="view-tag">Live Availability ⚡</div>
        </div>

        {error ? <div className="alert-error" role="alert">{error}</div> : null}

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Gathering upcoming events...</p>
          </div>
        ) : null}

        {!loading && events.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🎟️</span>
            <h3>No events found matching your search</h3>
            <p className="muted">Try adjusting your filters, location, or search keywords.</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setSearch('')
                setCity('')
                setSelectedCategory('All')
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : null}

        <div className="events-grid">
          {events.map((event, idx) => {
            const dateObj = new Date(event.start_at)
            const monthStr = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase()
            const dayStr = dateObj.getDate()
            const category = getEventCategory(event.title)

            return (
              <Link key={event.id} to={`/events/${event.id}`} className="event-card-modern">
                <div className={`event-card-banner gradient-theme-${(idx % 4) + 1}`}>
                  <div className="event-card-badge-row">
                    <span className="card-category-badge">{category}</span>
                    <span className="card-status-badge">Available</span>
                  </div>
                  <div className="card-calendar-chip">
                    <span className="chip-month">{monthStr}</span>
                    <span className="chip-day">{dayStr}</span>
                  </div>
                </div>

                <div className="event-card-body">
                  <h3 className="event-card-title">{event.title}</h3>
                  <p className="event-card-desc">
                    {event.description ? truncateText(event.description, 110) : 'Join industry innovators for an unforgettable experience.'}
                  </p>

                  <div className="event-meta-info">
                    <div className="meta-row">
                      <span className="meta-icon">📍</span>
                      <span className="meta-text">{event.venue?.city ? `${event.venue.name}, ${event.venue.city}` : 'Global Online Stream'}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-icon">🕒</span>
                      <span className="meta-text">{formatTime(event.start_at)}</span>
                    </div>
                  </div>

                  <div className="event-card-footer">
                    <div className="price-tag">
                      <span className="price-label">Tickets from</span>
                      <span className="price-amount">{getSamplePrice(idx)}</span>
                    </div>
                    <span className="btn-get-tickets">
                      Get Tickets →
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {totalPages > 1 ? (
          <div className="pagination">
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
            >
              ← Previous
            </button>
            <span className="pagination-text">Page {page} of {totalPages}</span>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
            >
              Next →
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function getCategoryEmoji(cat: string): string {
  switch (cat) {
    case 'Technology': return '💻'
    case 'Music': return '🎵'
    case 'Design': return '🎨'
    case 'Culinary': return '🍷'
    case 'Sports': return '🏃'
    default: return '🌟'
  }
}

function getEventCategory(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('tech') || t.includes('ai') || t.includes('hackathon')) return 'Technology'
  if (t.includes('music') || t.includes('waves')) return 'Music'
  if (t.includes('design') || t.includes('product')) return 'Design'
  if (t.includes('wine') || t.includes('gastronomy') || t.includes('culinary')) return 'Culinary'
  if (t.includes('marathon') || t.includes('10k')) return 'Sports'
  return 'Experience'
}

function getSamplePrice(idx: number): string {
  const prices = ['$199', '$79', '$249', '$185', '$65', 'Free']
  return prices[idx % prices.length]
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen).trim() + '...'
}

function formatTime(dateString: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateString))
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
