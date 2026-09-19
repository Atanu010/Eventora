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
    <section>
      <h2>Create account</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
        </label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Register'}</button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Login</Link></p>
    </section>
  )
}
