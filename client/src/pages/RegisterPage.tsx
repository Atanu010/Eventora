import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function RegisterPage() {
  const navigate = useNavigate()
  const { registerUser, loginUser } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await registerUser(name.trim(), email.trim(), password)
      await loginUser(email.trim(), password)
      navigate('/events')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-card-header">
          <span className="auth-icon">✨</span>
          <h2 className="auth-title">Create your Eventora account</h2>
          <p className="auth-subtitle">Join thousands of attendees and event organizers worldwide.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>Full Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Jordan Miller"
              required
            />
          </label>
          <label className="auth-field">
            <span>Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="e.g. jordan@example.com"
              required
            />
          </label>
          <label className="auth-field">
            <span>Password (min. 8 characters)</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </label>

          {error ? <div className="alert-error" role="alert">{error}</div> : null}

          <button type="submit" className="btn-auth-submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>
        </form>

        <div className="auth-footer-link">
          <span>Already registered? </span>
          <Link to="/login" className="accent-link">Sign in here</Link>
        </div>
      </div>
    </div>
  )
}
