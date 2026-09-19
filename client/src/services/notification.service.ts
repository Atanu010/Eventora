export interface Notification {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  status: 'pending' | 'delivered' | 'failed'
  read_at: string | null
  created_at: string
}

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export function listNotifications(accessToken: string, unreadOnly = false): Promise<{ data: Notification[] }> {
  return request(`/api/notifications${unreadOnly ? '?unread=true' : ''}`, accessToken)
}

export function markNotificationRead(notificationId: string, accessToken: string): Promise<void> {
  return request(`/api/notifications/${notificationId}/read`, accessToken, { method: 'POST' })
}

export function markAllNotificationsRead(accessToken: string): Promise<{ updated: number }> {
  return request('/api/notifications/read-all', accessToken, { method: 'POST' })
}

async function request<T>(path: string, accessToken: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...options.headers },
  })
  if (response.status === 204) return undefined as T
  const body = await response.json() as T | { error?: { message?: string } }
  if (!response.ok) throw new Error(typeof body === 'object' && body !== null && 'error' in body ? body.error?.message ?? 'Notification request failed' : 'Notification request failed')
  return body as T
}