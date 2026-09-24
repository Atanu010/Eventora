import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Layout() {
  const { user, logout, isAuthenticated, switchDemoRole } = useAuth()

  return (
    <div className="app-shell">
      {/* Top Demo Bar */}
      <div className="demo-topbar">
        <div className="demo-topbar-content">
          <span className="demo-badge">🚀 Live Interactive Demo</span>
          <span className="demo-hint">Switch Persona:</span>
          <div className="demo-role-buttons">
            <button
              type="button"
              className={`demo-btn ${user?.role === 'attendee' ? 'active' : ''}`}
              onClick={() => switchDemoRole('attendee')}
              title="Test as regular ticket buyer"
            >
              👤 Attendee
            </button>
            <button
              type="button"
              className={`demo-btn ${user?.role === 'organizer' ? 'active' : ''}`}
              onClick={() => switchDemoRole('organizer')}
              title="Test as event creator & check-in manager"
            >
              🎪 Organizer
            </button>
            <button
              type="button"
              className={`demo-btn ${user?.role === 'admin' ? 'active' : ''}`}
              onClick={() => switchDemoRole('admin')}
              title="Test as system administrator"
            >
              🛡️ Admin
            </button>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="main-navbar">
        <div className="nav-container">
          <Link to="/events" className="brand-logo">
            <span className="brand-icon">🎟️</span>
            <div>
              <span className="brand-name">Eventora</span>
              <span className="brand-tag">Ticketing Platform</span>
            </div>
          </Link>

          <nav className="nav-links">
            <NavLink to="/events" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              Explore Events
            </NavLink>

            {isAuthenticated ? (
              <>
                <NavLink to="/orders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  Orders
                </NavLink>
                <NavLink to="/tickets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  My Tickets
                </NavLink>
                <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  Notifications
                </NavLink>

                {user && (user.role === 'organizer' || user.role === 'admin') && (
                  <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    Dashboard
                  </NavLink>
                )}

                {user && (user.role === 'organizer' || user.role === 'admin') && (
                  <NavLink to="/organizer/check-in" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    Check-in
                  </NavLink>
                )}

                {user?.role === 'admin' && (
                  <NavLink to="/admin/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    Admin
                  </NavLink>
                )}

                <div className="user-profile-badge">
                  <span className="user-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                  <div className="user-info">
                    <span className="user-name">{user?.name}</span>
                    <span className="user-role">{user?.role}</span>
                  </div>
                  <button type="button" className="btn-logout" onClick={logout} title="Sign out">
                    ✕
                  </button>
                </div>
              </>
            ) : (
              <div className="auth-nav-actions">
                <NavLink to="/login" className="nav-btn-link">Sign In</NavLink>
                <NavLink to="/register" className="nav-btn-primary">Get Started</NavLink>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="main-footer">
        <div className="footer-content">
          <div className="footer-left">
            <span className="footer-logo">🎟️ Eventora</span>
            <p className="footer-desc">Next-generation event discovery, dynamic seating, and QR-code check-in platform.</p>
          </div>
          <div className="footer-right">
            <span>Client v0.1.0 • Running on GitHub Pages</span>
            <span>All systems operational 🟢</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
