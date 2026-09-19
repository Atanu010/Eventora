import rateLimit from 'express-rate-limit'
import { environment } from '../config/env'

const standard = { windowMs: environment.rateLimitWindowMs, standardHeaders: 'draft-8' as const, legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } } }
export const authRateLimiter = rateLimit({ ...standard, max: environment.authRateLimitMax })
export const sensitiveRateLimiter = rateLimit({ ...standard, max: environment.sensitiveRateLimitMax })