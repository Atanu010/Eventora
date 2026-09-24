import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { loginUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginUser(email.trim(), password)
      navigate('/events')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail)
    setPassword('demo-password-123')
  }

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-card-header">
          <span className="auth-icon">🎟️</span>
          <h2 className="auth-title">Welcome back to Eventora</h2>
          <p className="auth-subtitle">Sign in to view your tickets, bookings, and dashboard.</p>
        </div>

        {/* 1-Click Demo Login Box */}
        <div className="demo-accounts-box">
          <span className="demo-accounts-label">⚡ 1-Click Fill Demo Credentials:</span>
          <div className="demo-accounts-grid">
            <button
              type="button"
              className="btn-demo-pill"
              onClick={() => fillDemo('alex@example.com')}
            >
              👤 Attendee (Alex)
            </button>
            <button
              type="button"
              className="btn-demo-pill"
              onClick={() => fillDemo('elena@eventora.io')}
            >
              🎪 Organizer (Elena)
            </button>
            <button
              type="button"
              className="btn-demo-pill"
              onClick={() => fillDemo('admin@eventora.io')}
            >
              🛡️ Admin (Marcus)
            </button>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="e.g. alex@example.com"
              required
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error ? <div className="alert-error" role="alert">{error}</div> : null}

          <button type="submit" className="btn-auth-submit" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In →'}
          </button>
        </form>

        <div className="auth-footer-link">
          <span>Don't have an account yet? </span>
          <Link to="/register" className="accent-link">Create an account</Link>
        </div>
      </div>
    </div>
  )
}
