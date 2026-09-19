import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function OrganizerRoute() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user || (user.role !== 'organizer' && user.role !== 'admin')) {
    return <Navigate to="/events" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}