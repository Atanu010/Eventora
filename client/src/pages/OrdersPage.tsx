import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { listOrders } from '../services/order.service'
import type { Order } from '../types/order'

export function OrdersPage() {
  const location = useLocation()
  const { accessToken } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load(): Promise<void> {
      if (!accessToken) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      try {
        const response = await listOrders(accessToken)
        setOrders(response.data)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load orders')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [accessToken])

  const bannerMessage = typeof (location.state as { message?: string } | null)?.message === 'string' ? (location.state as { message?: string }).message : ''

  return (
    <div className="orders-page">
      <div className="section-header-row">
        <div>
          <h2 className="section-title">Order History & Invoices</h2>
          <p className="section-subtitle">Manage ticket orders, view itemized receipts, and download passes.</p>
        </div>
        <Link to="/tickets" className="btn-secondary-sm">
          🎟️ View All Digital Passes
        </Link>
      </div>

      {bannerMessage ? <div className="alert-success">{bannerMessage}</div> : null}
      {error ? <div className="alert-error" role="alert">{error}</div> : null}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your orders...</p>
        </div>
      ) : null}

      {!loading && orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <h3>No orders yet</h3>
          <p className="muted">You haven't placed any ticket orders yet.</p>
          <Link to="/events" className="btn-primary">Explore Upcoming Events</Link>
        </div>
      ) : null}

      <div className="orders-list">
        {orders.map((order) => (
          <div key={order.id} className="order-summary-card">
            <div className="order-card-header">
              <div>
                <span className="order-label">ORDER NUMBER</span>
                <h3 className="order-number-title">{order.order_number}</h3>
              </div>
              <div className="order-badges-group">
                <span className="badge-payment-status">
                  {order.payment_status === 'paid' ? '🟢 Paid' : order.payment_status}
                </span>
                <span className="badge-order-status">{order.status}</span>
              </div>
            </div>

            <div className="order-items-list">
              {order.items.map((item) => (
                <div key={item.id} className="order-item-row">
                  <span className="item-icon">🎟️</span>
                  <div className="item-details">
                    <strong className="item-title">{item.event_title}</strong>
                    <span className="item-qty">Quantity: {item.quantity} pass(es)</span>
                  </div>
                  <span className="item-price">{formatMoney(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="order-card-footer">
              <div className="order-total-block">
                <span className="total-label">Grand Total</span>
                <strong className="total-amount">{formatMoney(order.total_amount)}</strong>
              </div>
              <div className="order-actions">
                <Link to="/tickets" className="btn-action-primary">
                  View Pass / QR →
                </Link>
                <Link to={`/orders/${order.id}`} className="btn-action-secondary">
                  Receipt Details
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatMoney(value: string | number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value))
}
