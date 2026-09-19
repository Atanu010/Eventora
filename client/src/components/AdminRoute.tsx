import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function AdminRoute() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <div>Checking session...</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== 'admin') return <Navigate to="/events" replace />
  return <Outlet />
}