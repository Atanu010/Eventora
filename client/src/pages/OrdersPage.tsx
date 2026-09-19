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
    <section>
      <h2>My orders</h2>
      {bannerMessage ? <p className="success">{bannerMessage}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {loading ? <p>Loading orders...</p> : null}
      {!loading && orders.length === 0 ? <p className="muted">No orders yet.</p> : null}
      <div className="list-stack">
        {orders.map((order) => (
          <div key={order.id} className="list-card">
            <div className="summary-line">
              <strong>{order.order_number}</strong>
              <span>{order.status}</span>
            </div>
            <p className="muted">Payment: {order.payment_status}</p>
            <p>{order.items.map((item) => `${item.event_title} (${item.quantity})`).join(', ') || 'No items'}</p>
            <p>Total: {formatMoney(order.total_amount)}</p>
            <Link to={`/orders/${order.id}`}>View details</Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatMoney(value: string | number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value))
}
