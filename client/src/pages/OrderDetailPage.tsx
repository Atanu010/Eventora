import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getOrder, initializePayment, listOrderTickets, listRefunds, requestRefund, verifyPayment } from '../services/order.service'
import type { Order, Ticket } from '../types/order'
import type { Refund } from '../services/order.service'

export function OrderDetailPage() {
  const { id } = useParams()
  const { accessToken } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [refunding, setRefunding] = useState(false)

  const orderId = id ?? ''

  useEffect(() => {
    if (!orderId || !accessToken) return
    const token = accessToken
    async function load(): Promise<void> {
      setLoading(true)
      setError('')
      try {
        const [orderResult, ticketsResult, refundResult] = await Promise.all([
          getOrder(orderId, token),
          listOrderTickets(orderId, token),
          listRefunds(orderId, token),
        ])
        setOrder(orderResult)
        setTickets(ticketsResult.data)
        setRefunds(refundResult.data)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to load order')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [accessToken, orderId])

  async function handleRefund(): Promise<void> {
    if (!order || !accessToken || !window.confirm('Request a full refund for this order?')) return
    setRefunding(true)
    setError('')
    try {
      const result = await requestRefund(order.id, accessToken, crypto.randomUUID(), 'Customer requested refund')
      setRefunds((current) => [result.refund, ...current])
      setOrder({ ...order, status: 'refunded', payment_status: 'refunded' })
      setTickets((current) => current.map((ticket) => ({ ...ticket, status: 'cancelled' })))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request refund')
    } finally { setRefunding(false) }
  }

  async function handlePayment(): Promise<void> {
    if (!order || !accessToken) return
    setPaying(true)
    setError('')
    setPaymentMessage('')
    try {
      await loadRazorpayScript()
      const initialization = await initializePayment(order.id, accessToken)
      const RazorpayConstructor = window.Razorpay
      if (!RazorpayConstructor) throw new Error('Razorpay Checkout could not be loaded')
      await new Promise<void>((resolve, reject) => {
        const checkout = new RazorpayConstructor({
          key: initialization.keyId,
          amount: initialization.amount,
          currency: initialization.currency,
          name: 'Eventora',
          description: order.items.map((item) => item.event_title).join(', '),
          order_id: initialization.razorpayOrderId,
          handler: (response) => {
            void verifyPayment({ orderId: order.id, razorpayOrderId: response.razorpay_order_id, razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature }, accessToken)
              .then(() => pollForConfirmation(order.id, accessToken))
              .then((confirmedOrder) => {
                setOrder(confirmedOrder)
                setPaymentMessage('Payment successful. Your order is confirmed.')
                return listOrderTickets(order.id, accessToken)
              })
              .then((ticketResult) => { setTickets(ticketResult.data); resolve() })
              .catch(reject)
          },
        })
        checkout.on('payment.failed', () => reject(new Error('Payment failed. Your order remains unpaid.')))
        checkout.open()
      })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to complete payment')
    } finally {
      setPaying(false)
    }
  }

  if (loading) return <section><h2>Order</h2><p>Loading order...</p></section>
  if (error) return <section><h2>Order</h2><p className="error" role="alert">{error}</p></section>
  if (!order) return <section><h2>Order</h2><p className="muted">Order not found.</p></section>

  return (
    <section>
      <Link to="/orders">← Back to orders</Link>
      <h2>{order.order_number}</h2>
      <p>Status: {order.status}</p>
      <p>Payment: {order.payment_status}</p>
      <p>Total: {formatMoney(order.total_amount)}</p>
      {refunds.map((refund) => <p key={refund.id} className={refund.status === 'processed' ? 'success' : 'muted'}>Refund: {refund.status} {formatMoney(refund.amount)}</p>)}
      {order.status === 'confirmed' && order.payment_status === 'paid' && !refunds.some((refund) => refund.status === 'processed') && !tickets.some((ticket) => ticket.status === 'used') ? <button type="button" onClick={() => void handleRefund()} disabled={refunding}>{refunding ? 'Requesting refund...' : 'Request full refund'}</button> : null}
      {paymentMessage ? <p className="success" role="status">{paymentMessage}</p> : null}
      {order.status === 'pending' && order.payment_status === 'pending' ? (
        <button type="button" onClick={() => void handlePayment()} disabled={paying}>
          {paying ? 'Opening payment...' : 'Proceed to payment'}
        </button>
      ) : null}
      <div>
        {order.items.map((item) => (
          <div key={item.id} className="list-card">
            <strong>{item.event_title}</strong>
            <p>Quantity: {item.quantity}</p>
            <p>Unit price: {formatMoney(item.unit_price)}</p>
            <p>Subtotal: {formatMoney(item.subtotal)}</p>
          </div>
        ))}
      </div>
      {tickets.length ? (
        <div>
          <h3>Tickets</h3>
          {tickets.map((ticket) => (
            <div key={ticket.id} className="list-card">
              <p><strong>{ticket.ticket_number}</strong></p>
              <p>{ticket.event_title}</p>
              <p>Status: {ticket.status}</p>
              <p>QR: {ticket.qr_token ? ticket.qr_token.slice(0, 12) + '…' : 'Unavailable'}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string
      amount: number
      currency: string
      name: string
      description: string
      order_id: string
      handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void
    }) => { open: () => void; on: (event: string, handler: () => void) => void }
  }
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout'))
    document.head.appendChild(script)
  })
}

async function pollForConfirmation(orderId: string, accessToken: string): Promise<Order> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const current = await getOrder(orderId, accessToken)
    if (current.status === 'confirmed' && current.payment_status === 'paid') return current
    await new Promise((resolve) => window.setTimeout(resolve, 1000))
  }
  throw new Error('Payment was received but confirmation is still pending. Refresh this order shortly.')
}

function formatMoney(value: string | number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value))
}
