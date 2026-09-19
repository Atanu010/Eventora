import { createHmac, timingSafeEqual } from 'node:crypto'
import { getRazorpayConfiguration } from '../config/env'

interface RazorpayOrderResponse {
  id: string
}

export interface RazorpayPaymentResponse {
  id: string
  order_id: string
  amount: number
  currency: string
  status: string
  method?: string
  error_code?: string
  error_description?: string
}

export interface RazorpayRefundResponse {
  id: string
  payment_id: string
  amount: number
  currency: string
  status: string
  notes?: Record<string, string>
}

function authorizationHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
}

async function razorpayRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { keyId, keySecret } = getRazorpayConfiguration()
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: authorizationHeader(keyId, keySecret),
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!response.ok) throw new Error(`Razorpay request failed with status ${response.status}`)
  return response.json() as Promise<T>
}

export async function createRazorpayOrder(amount: number, currency: string, receipt: string): Promise<RazorpayOrderResponse> {
  return razorpayRequest<RazorpayOrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify({ amount, currency, receipt, payment_capture: 1 }),
  })
}

export async function getRazorpayPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
  return razorpayRequest<RazorpayPaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`)
}

export async function createRazorpayRefund(paymentId: string, amount: number, notes: Record<string, string> = {}): Promise<RazorpayRefundResponse> {
  return razorpayRequest<RazorpayRefundResponse>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST',
    body: JSON.stringify({ amount, notes }),
  })
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = getRazorpayConfiguration()
  const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex')
  return signaturesEqual(expected, signature)
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const { webhookSecret } = getRazorpayConfiguration()
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
  return signaturesEqual(expected, signature)
}

function signaturesEqual(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
}