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

const app = express()

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), webhook)
app.use(express.json())
app.use('/api', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/events', eventRouter)
app.use('/api/venues', venueRouter)
app.use('/api/orders', orderRouter)
app.use('/api/tickets', ticketRouter)
app.use('/api/payments', paymentRouter)
app.use('/api/notifications', notificationRouter)
app.use('/api/dashboard', dashboardRouter)
app.use(errorHandler)

export default app
