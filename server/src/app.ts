import express from 'express'
import { errorHandler } from './middleware/error-handler'
import authRouter from './routes/auth.routes'
import eventRouter from './routes/event.routes'
import healthRouter from './routes/health.routes'
import orderRouter from './routes/order.routes'
import ticketRouter from './routes/ticket.routes'
import venueRouter from './routes/venue.routes'
import paymentRouter from './routes/payment.routes'
import { webhook } from './controllers/payment.controller'
import notificationRouter from './routes/notification.routes'
import dashboardRouter from './routes/dashboard.routes'
import adminRouter from './routes/admin.routes'
import cors from 'cors'
import helmet from 'helmet'
import { environment } from './config/env'
import { requestContext } from './middleware/request-context'
import { sensitiveRateLimiter } from './middleware/rate-limiters'
import { AppError } from './utils/errors'

const app = express()

app.use(requestContext)
app.use((request, response, next) => { request.setTimeout(environment.requestTimeoutMs); response.setTimeout(environment.requestTimeoutMs); next() })
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://checkout.razorpay.com'], frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'], connectSrc: ["'self'", environment.clientOrigin, 'https://api.razorpay.com'], imgSrc: ["'self'", 'data:', 'https:'], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"] } }, referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, frameguard: { action: 'deny' }, permittedCrossDomainPolicies: { permittedPolicies: 'none' } }))
app.use(cors({ origin: (origin, callback) => { if (!origin || origin === environment.clientOrigin) callback(null, true); else callback(new AppError(403, 'CORS_ORIGIN_DENIED', 'Origin is not allowed')) }, credentials: true }))
app.post('/api/payments/webhook', sensitiveRateLimiter, express.raw({ type: 'application/json', limit: environment.jsonLimit }), webhook)
app.use(express.json({ limit: environment.jsonLimit }))
app.use((request, response, next) => { response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); next() })
app.use('/api', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/events', eventRouter)
app.use('/api/venues', venueRouter)
app.use('/api/orders', sensitiveRateLimiter, orderRouter)
app.use('/api/tickets', sensitiveRateLimiter, ticketRouter)
app.use('/api/payments', sensitiveRateLimiter, paymentRouter)
app.use('/api/notifications', notificationRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/admin', sensitiveRateLimiter, adminRouter)
app.use(errorHandler)

export default app
