import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Layout() {
  const { user, logout, isAuthenticated } = useAuth()

  return (
    <div>
      <header>
        <div>
          <h1>Eventora</h1>
          <p className="muted">Tickets and events</p>
        </div>
        <nav>
          <NavLink to="/events">Events</NavLink>
          {isAuthenticated ? (
            <>
              <NavLink to="/orders">My Orders</NavLink>
              <NavLink to="/tickets">My Tickets</NavLink>
              {user && (user.role === 'organizer' || user.role === 'admin') ? <NavLink to="/organizer/check-in">Check-in</NavLink> : null}
              <button type="button" onClick={logout}>Sign out</button>
            </>
          ) : (
            <NavLink to="/login">Login</NavLink>
          )}
        </nav>
      </header>
      {user ? <p className="muted">Signed in as {user.name} ({user.role})</p> : null}
      <main>
        <Outlet />
      </main>
    </div>
  )
}
