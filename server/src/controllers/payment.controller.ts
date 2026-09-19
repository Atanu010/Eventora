import type { NextFunction, Request, Response } from 'express'
import { paymentOrderIdSchema, paymentVerificationSchema } from '../validation/payment.schemas'
import { initializePayment, processWebhookPayment, verifyPayment } from '../services/payment.service'
import { verifyWebhookSignature } from '../services/razorpay.service'

export async function initialize(request: Request, response: Response, next: NextFunction): Promise<void> {
  try { response.json(await initializePayment(request.authUser!, paymentOrderIdSchema.parse(request.params).id)) } catch (error) { next(error) }
}

export async function verify(request: Request, response: Response, next: NextFunction): Promise<void> {
  try { response.json({ order: await verifyPayment(request.authUser!, paymentVerificationSchema.parse(request.body)) }) } catch (error) { next(error) }
}

export async function webhook(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const signature = request.header('x-razorpay-signature')
    const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from('')
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      response.status(400).json({ error: { code: 'INVALID_WEBHOOK_SIGNATURE', message: 'Webhook signature is invalid' } })
      return
    }
    let payload: Record<string, unknown>
    try { payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown> } catch { response.status(400).json({ error: { code: 'INVALID_WEBHOOK_PAYLOAD', message: 'Webhook payload is invalid' } }); return }
    const eventType = typeof payload.event === 'string' ? payload.event : ''
    const providerEventId = typeof payload.id === 'string' ? payload.id : request.header('x-razorpay-event-id')
    if (!eventType || !providerEventId) { response.status(400).json({ error: { code: 'INVALID_WEBHOOK_PAYLOAD', message: 'Webhook payload is incomplete' } }); return }
    await processWebhookPayment({ eventType, providerEventId, payload })
    response.json({ received: true })
  } catch (error) { next(error) }
}