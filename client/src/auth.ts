import type { AuthUser } from './types/auth'

export interface StoredAuthState {
  accessToken: string
  user: AuthUser
}

const STORAGE_KEY = 'eventora-auth'

export function readStoredAuthState(): StoredAuthState | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<StoredAuthState>
    if (!parsed.accessToken || !parsed.user) return null
    return { accessToken: parsed.accessToken, user: parsed.user }
  } catch {
    return null
  }
}

export function writeStoredAuthState(state: StoredAuthState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearStoredAuthState(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}
