import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notification.service'
import type { Notification } from '../services/notification.service'

export function NotificationsPage() {
  const { accessToken } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(): Promise<void> {
    if (!accessToken) return
    setLoading(true)
    try { setNotifications((await listNotifications(accessToken)).data) } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load notifications') } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [accessToken])

  async function read(notification: Notification): Promise<void> {
    if (!accessToken || notification.read_at) return
    await markNotificationRead(notification.id, accessToken)
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item))
  }

  async function readAll(): Promise<void> {
    if (!accessToken) return
    await markAllNotificationsRead(accessToken)
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })))
  }

  return (
    <section>
      <div className="summary-line"><h2>Notifications</h2><button type="button" onClick={() => void readAll()}>Mark all read</button></div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {loading ? <p>Loading notifications...</p> : null}
      {!loading && !notifications.length ? <p className="muted">No notifications yet.</p> : null}
      <div className="list-stack">
        {notifications.map((notification) => (
          <button type="button" className={notification.read_at ? 'list-card notification' : 'list-card notification unread'} key={notification.id} onClick={() => void read(notification)}>
            <strong>{notification.title}</strong>
            <p>{notification.body}</p>
            <small>{formatDate(notification.created_at)}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }