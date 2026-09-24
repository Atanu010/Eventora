import type { Event, EventListResponse } from '../types/event'
import { getDemoEvents, getDemoEvent } from './demoStore'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function listEvents(accessToken?: string, query?: { page?: number; limit?: number; search?: string; city?: string }): Promise<EventListResponse> {
  try {
    const url = new URL(`${apiUrl}/api/events`)
    if (query?.page) url.searchParams.set('page', String(query.page))
    if (query?.limit) url.searchParams.set('limit', String(query.limit))
    if (query?.search) url.searchParams.set('search', query.search)
    if (query?.city) url.searchParams.set('city', query.city)

    const response = await fetch(url, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    const body = await response.json() as EventListResponse | { error?: { message?: string } }
    if (!response.ok) {
      return getDemoEvents(query?.search, query?.city)
    }
    return body as EventListResponse
  } catch {
    return getDemoEvents(query?.search, query?.city)
  }
}

export async function getEvent(id: string, accessToken?: string): Promise<Event> {
  try {
    const response = await fetch(`${apiUrl}/api/events/${id}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    const body = await response.json() as Event | { error?: { message?: string } }
    if (!response.ok) {
      return getDemoEvent(id)
    }
    return body as Event
  } catch {
    return getDemoEvent(id)
  }
}

export async function createEvent(input: { title: string; description?: string; start_at: string; end_at: string }, accessToken: string): Promise<{ event: Event }> {
  return request<{ event: Event }>('/api/events', { method: 'POST', body: JSON.stringify(input), accessToken })
}

export async function updateEvent(id: string, input: { title?: string; description?: string; start_at?: string; end_at?: string }, accessToken: string): Promise<{ event: Event }> {
  return request<{ event: Event }>(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify(input), accessToken })
}

async function request<T>(path: string, options: { method?: string; body?: string; accessToken?: string } = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? 'GET',
    body: options.body,
    headers: {
      'Content-Type': 'application/json',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
  })
  const body = await response.json() as T | { error?: { message?: string } }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body ? body.error?.message : undefined
    throw new Error(message ?? 'Event request failed')
  }
  return body as T
}
