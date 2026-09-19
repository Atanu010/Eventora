import { FormEvent, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { checkInTicket } from '../services/order.service'

interface CheckInResult {
  success: boolean
  alreadyCheckedIn: boolean
  ticketNumber: string
  eventTitle: string
  ticketType: string
  attendeeName: string
  checkedInAt: string
}

export function CheckInPage() {
  const { accessToken } = useAuth()
  const [qrToken, setQrToken] = useState('')
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!accessToken || !qrToken.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await checkInTicket(qrToken.trim(), accessToken)
      setResult(response)
      setQrToken('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to check in ticket')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2>Event check-in</h2>
      <p className="muted">Enter the attendee QR token to validate and check in one ticket.</p>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label>
          QR token
          <input
            value={qrToken}
            onChange={(event) => setQrToken(event.target.value)}
            autoComplete="off"
            autoFocus
            placeholder="Paste or scan token"
            disabled={loading}
          />
        </label>
        <button type="submit" disabled={loading || !qrToken.trim()}>
          {loading ? 'Checking...' : 'Check in ticket'}
        </button>
      </form>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {result ? (
        <div className={result.alreadyCheckedIn ? 'check-in-result already-used' : 'check-in-result success'} role="status">
          <strong>{result.alreadyCheckedIn ? 'Already checked in' : 'Check-in successful'}</strong>
          <p>{result.eventTitle}</p>
          <p>{result.ticketType} · {result.ticketNumber}</p>
          <p>Attendee: {result.attendeeName}</p>
          <p>Checked in: {formatDate(result.checkedInAt)}</p>
        </div>
      ) : null}
    </section>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}