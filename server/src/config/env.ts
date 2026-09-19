import 'dotenv/config'
import type { SignOptions } from 'jsonwebtoken'

const nodeEnv = process.env.NODE_ENV ?? 'development'
const databaseUrl = process.env.DATABASE_URL
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
const port = Number(process.env.PORT ?? 3000)
const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '1h'
const jsonLimit = process.env.JSON_BODY_LIMIT ?? '1mb'
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 15_000)
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000)
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10)
const sensitiveRateLimitMax = Number(process.env.SENSITIVE_RATE_LIMIT_MAX ?? 100)

if (!databaseUrl) throw new Error('DATABASE_URL is required to run the Eventora server')
try {
  const parsedDatabaseUrl = new URL(databaseUrl)
  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) throw new Error('unsupported protocol')
} catch { throw new Error('DATABASE_URL must be a valid PostgreSQL URL') }
if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error('NODE_ENV must be development, test, or production')
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port')
try { new URL(clientOrigin) } catch { throw new Error('CLIENT_ORIGIN must be a valid URL') }
if (!jwtExpiresIn.trim()) throw new Error('JWT_EXPIRES_IN must not be empty')
if (!/^\d+(ms|s|m|h|d|w|y)$/.test(jwtExpiresIn) && !/^\d+$/.test(jwtExpiresIn)) throw new Error('JWT_EXPIRES_IN must be a valid duration')
if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1_000) throw new Error('REQUEST_TIMEOUT_MS must be at least 1000')
if (!Number.isInteger(rateLimitWindowMs) || rateLimitWindowMs < 1_000) throw new Error('RATE_LIMIT_WINDOW_MS must be at least 1000')
if (!Number.isInteger(authRateLimitMax) || authRateLimitMax < 1) throw new Error('AUTH_RATE_LIMIT_MAX must be positive')
if (!Number.isInteger(sensitiveRateLimitMax) || sensitiveRateLimitMax < 1) throw new Error('SENSITIVE_RATE_LIMIT_MAX must be positive')
if (nodeEnv === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) throw new Error('JWT_SECRET must be at least 32 characters long in production')
if (nodeEnv === 'production' && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.RAZORPAY_WEBHOOK_SECRET)) throw new Error('Razorpay configuration is required in production')

export const environment = {
  databaseUrl,
  clientOrigin,
  nodeEnv,
  port,
  jsonLimit,
  requestTimeoutMs,
  rateLimitWindowMs,
  authRateLimitMax,
  sensitiveRateLimitMax,
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
    expiresIn: jwtExpiresIn as SignOptions['expiresIn'],
  }
}
