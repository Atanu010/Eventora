import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getCurrentUser, login, register } from '../services/auth.service'
import { clearStoredAuthState, readStoredAuthState, writeStoredAuthState } from '../auth'
import type { AuthUser } from '../types/auth'

interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  loginUser: (email: string, password: string) => Promise<void>
  registerUser: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const hydrate = useCallback(async (): Promise<void> => {
    const stored = readStoredAuthState()
    if (!stored) {
      setUser(null)
      setAccessToken(null)
      setIsLoading(false)
      return
    }

    try {
      setAccessToken(stored.accessToken)
      const currentUser = await getCurrentUser(stored.accessToken)
      setUser(currentUser)
      writeStoredAuthState({ accessToken: stored.accessToken, user: currentUser })
    } catch {
      clearStoredAuthState()
      setUser(null)
      setAccessToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const persistSession = useCallback((nextAccessToken: string, nextUser: AuthUser): void => {
    setAccessToken(nextAccessToken)
    setUser(nextUser)
    writeStoredAuthState({ accessToken: nextAccessToken, user: nextUser })
  }, [])

  const loginUser = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await login({ email, password })
    persistSession(response.accessToken, response.user)
  }, [persistSession])

  const registerUser = useCallback(async (name: string, email: string, password: string): Promise<void> => {
    await register({ name, email, password })
  }, [])

  const logout = useCallback((): void => {
    setUser(null)
    setAccessToken(null)
    clearStoredAuthState()
  }, [])

  const refreshUser = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      setUser(null)
      return
    }
    try {
      const currentUser = await getCurrentUser(accessToken)
      setUser(currentUser)
      writeStoredAuthState({ accessToken, user: currentUser })
    } catch {
      clearStoredAuthState()
      setUser(null)
      setAccessToken(null)
    }
  }, [accessToken])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    accessToken,
    isAuthenticated: Boolean(accessToken && user),
    isLoading,
    loginUser,
    registerUser,
    logout,
    refreshUser,
  }), [accessToken, isLoading, loginUser, logout, refreshUser, registerUser, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
