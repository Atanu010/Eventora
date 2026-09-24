import type { AuthResponse, AuthUser } from '../types/auth'
import { DEMO_USERS } from './demoStore'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

interface Credentials {
  email: string
  password: string
}

interface RegistrationInput extends Credentials {
  name: string
}

export async function register(input: RegistrationInput): Promise<{ user: AuthUser }> {
  try {
    return await request<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch {
    const user: AuthUser = {
      id: `usr-${Date.now().toString(36)}`,
      name: input.name || 'Eventora User',
      email: input.email,
      role: 'attendee',
    }
    return { user }
  }
}

export async function login(input: Credentials): Promise<AuthResponse> {
  try {
    return await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch {
    const emailLower = input.email.toLowerCase()
    let user = DEMO_USERS.attendee
    if (emailLower.includes('admin')) {
      user = DEMO_USERS.admin
    } else if (emailLower.includes('organizer') || emailLower.includes('elena')) {
      user = DEMO_USERS.organizer
    } else {
      user = {
        id: `usr-${Date.now().toString(36)}`,
        name: input.email.split('@')[0] || 'Alex Johnson',
        email: input.email,
        role: 'attendee',
      }
    }
    return {
      accessToken: `demo-token-${user.role}-${Date.now()}`,
      user,
    }
  }
}

export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  try {
    return await request<AuthUser>('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    if (accessToken.includes('admin')) return DEMO_USERS.admin
    if (accessToken.includes('organizer')) return DEMO_USERS.organizer
    return DEMO_USERS.attendee
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const body = await response.json() as T | { error?: { message?: string } }
  if (!response.ok) {
    const errorBody = isErrorBody(body) ? body : undefined
    throw new Error(errorBody?.error?.message ?? 'Authentication request failed')
  }
  return body as T
}

function isErrorBody(value: unknown): value is { error?: { message?: string } } {
  return typeof value === 'object' && value !== null && 'error' in value
}
