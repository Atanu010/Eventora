import { Router } from 'express'
import { userTickets } from '../controllers/order.controller'
import { checkIn } from '../controllers/ticket.controller'
import { requireAuth } from '../middleware/authenticate'
import { requireRole } from '../middleware/authorize'

const ticketRouter = Router()
ticketRouter.use(requireAuth)
ticketRouter.get('/', userTickets)
ticketRouter.post('/check-in', requireRole('organizer', 'admin'), checkIn)

export default ticketRouter
