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

import { getDemoNotifications, markDemoNotificationRead as markDemoRead, markAllDemoNotificationsRead as markAllDemoRead } from './demoStore'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function listNotifications(accessToken: string, unreadOnly = false): Promise<{ data: Notification[] }> {
  try {
    return await request(`/api/notifications${unreadOnly ? '?unread=true' : ''}`, accessToken)
  } catch {
    const list = getDemoNotifications()
    const filtered = unreadOnly ? list.filter((n) => !n.read_at) : list
    return { data: filtered as Notification[] }
  }
}

export async function markNotificationRead(notificationId: string, accessToken: string): Promise<void> {
  try {
    await request(`/api/notifications/${notificationId}/read`, accessToken, { method: 'POST' })
  } catch {
    markDemoRead(notificationId)
  }
}

export async function markAllNotificationsRead(accessToken: string): Promise<{ updated: number }> {
  try {
    return await request('/api/notifications/read-all', accessToken, { method: 'POST' })
  } catch {
    markAllDemoRead()
    return { updated: 2 }
  }
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