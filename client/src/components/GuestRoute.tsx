import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div>Checking session...</div>
  }

  if (isAuthenticated) {
    return <Navigate to="/events" replace />
  }

  return <Outlet />
}
