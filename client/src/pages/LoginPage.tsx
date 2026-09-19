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

  return (
    <section>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
      </form>
      <p className="muted">Need an account? <Link to="/register">Create one</Link></p>
    </section>
  )
}
