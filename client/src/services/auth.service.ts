import type { AuthResponse, AuthUser } from '../types/auth'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

interface Credentials {
  email: string
  password: string
}

interface RegistrationInput extends Credentials {
  name: string
}

export async function register(input: RegistrationInput): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function login(input: Credentials): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
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
