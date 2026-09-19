import 'dotenv/config'
import type { SignOptions } from 'jsonwebtoken'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the Eventora server')
}

export const environment = {
  databaseUrl,
}

export function getRazorpayConfiguration(): { keyId: string; keySecret: string; webhookSecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!keyId || !keySecret || !webhookSecret) {
    throw new Error('Razorpay test-mode configuration is required for payment operations')
  }
  return { keyId, keySecret, webhookSecret }
}

export function getJwtConfiguration(): { secret: string; expiresIn: SignOptions['expiresIn'] } {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long')
  }
  return {
    secret,
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as SignOptions['expiresIn'],
  }
}
