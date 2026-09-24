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
  const [scannerActive, setScannerActive] = useState(true)
  const [recentScans, setRecentScans] = useState<CheckInResult[]>([
    {
      success: true,
      alreadyCheckedIn: false,
      ticketNumber: 'TCK-TECH-98210-A1',
      eventTitle: 'Global Tech & AI Summit 2026',
      ticketType: 'General Admission',
      attendeeName: 'Alex Johnson',
      checkedInAt: new Date(Date.now() - 120000).toISOString(),
    },
    {
      success: true,
      alreadyCheckedIn: false,
      ticketNumber: 'TCK-PREV-44102',
      eventTitle: 'Global Tech & AI Summit 2026',
      ticketType: 'VIP & Speaker Lounge',
      attendeeName: 'Sarah Connors',
      checkedInAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ])

  async function processToken(tokenToProcess: string): Promise<void> {
    if (!tokenToProcess.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const response = await checkInTicket(tokenToProcess.trim(), accessToken || 'demo-token')
      setResult(response)
      setQrToken('')
      if (response.success) {
        setRecentScans((prev) => [response, ...prev.slice(0, 7)])
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to check in ticket')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    await processToken(qrToken)
  }

  function handleQuickScan(sampleToken: string) {
    setQrToken(sampleToken)
    void processToken(sampleToken)
  }

  return (
    <div className="check-in-page">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Organizer Check-In Terminal</h2>
          <p className="section-subtitle">Real-time gate validation and attendee badge authorization.</p>
        </div>
        <div className="scanner-status-tag">
          <span className="pulsing-dot"></span>
          <span>Scanner Hardware Online</span>
        </div>
      </div>

      <div className="checkin-grid-layout">
        {/* Left Column: Scanner Viewfinder & Input */}
        <div className="scanner-main-col">
          <div className="scanner-viewport-box">
            <div className="viewfinder-frame">
              {scannerActive && <div className="scanning-laser-line"></div>}
              <div className="viewfinder-corner tl"></div>
              <div className="viewfinder-corner tr"></div>
              <div className="viewfinder-corner bl"></div>
              <div className="viewfinder-corner br"></div>
              <div className="viewfinder-center-guide">
                <span className="guide-icon">📷</span>
                <span className="guide-text">Align Attendee QR Code Here</span>
              </div>
            </div>

            <div className="scanner-controls-row">
              <button
                type="button"
                className="btn-toggle-camera"
                onClick={() => setScannerActive((v) => !v)}
              >
                {scannerActive ? '⏸️ Pause Viewfinder' : '▶️ Resume Viewfinder'}
              </button>
            </div>
          </div>

          {/* Quick Demo Test Buttons */}
          <div className="quick-test-section">
            <span className="quick-test-label">⚡ 1-Click Interactive Test Scans:</span>
            <div className="quick-test-buttons">
              <button
                type="button"
                className="btn-quick-scan"
                onClick={() => handleQuickScan('QR_EVT_TECH_98210_VALID_TOKEN')}
                disabled={loading}
              >
                🟢 Scan Sample Valid Ticket
              </button>
              <button
                type="button"
                className="btn-quick-scan"
                onClick={() => handleQuickScan('QR_USED_SAMPLE_TOKEN')}
                disabled={loading}
              >
                🟡 Scan Re-entry / Used Ticket
              </button>
            </div>
          </div>

          {/* Manual Input Form */}
          <form className="manual-token-form" onSubmit={(event) => void handleSubmit(event)}>
            <label className="token-input-label">
              Manual Token / Barcode Override:
              <div className="input-action-row">
                <input
                  value={qrToken}
                  onChange={(event) => setQrToken(event.target.value)}
                  autoComplete="off"
                  placeholder="Paste or type QR token (e.g. QR_EVT_TECH_98210_VALID_TOKEN)"
                  disabled={loading}
                />
                <button type="submit" className="btn-primary" disabled={loading || !qrToken.trim()}>
                  {loading ? 'Verifying...' : 'Validate'}
                </button>
              </div>
            </label>
          </form>

          {error ? <div className="alert-error" role="alert">{error}</div> : null}

          {/* Validation Status Result */}
          {result && (
            <div className={`checkin-status-card ${result.alreadyCheckedIn ? 'status-already-used' : 'status-approved'}`}>
              <div className="status-icon-circle">
                {result.alreadyCheckedIn ? '⚠️' : '✅'}
              </div>
              <div className="status-details">
                <h3 className="status-heading">
                  {result.alreadyCheckedIn ? 'ALREADY CHECKED IN' : 'CHECK-IN APPROVED'}
                </h3>
                <p className="status-event">{result.eventTitle}</p>
                <div className="status-badges-row">
                  <span className="status-badge-item">Tier: {result.ticketType}</span>
                  <span className="status-badge-item">Pass: {result.ticketNumber}</span>
                  <span className="status-badge-item">Attendee: {result.attendeeName}</span>
                </div>
                <small className="status-timestamp">Timestamp: {formatDate(result.checkedInAt)}</small>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Gate Activity Feed */}
        <div className="activity-sidebar-col">
          <div className="activity-feed-card">
            <h3 className="feed-title">Recent Gate Activity</h3>
            <p className="feed-desc">Live log of verified entries for this session.</p>

            <div className="feed-items-list">
              {recentScans.map((scan, i) => (
                <div key={i} className="feed-entry-item">
                  <div className="feed-indicator green"></div>
                  <div className="feed-info">
                    <span className="feed-name">{scan.attendeeName}</span>
                    <span className="feed-meta">{scan.ticketType} • {scan.ticketNumber}</span>
                  </div>
                  <span className="feed-time">
                    {new Date(scan.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}