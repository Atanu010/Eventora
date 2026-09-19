import { Router } from 'express'
import * as eventController from '../controllers/event.controller'
import * as ticketTypeController from '../controllers/ticket-type.controller'
import { requireAuth } from '../middleware/authenticate'
import { requireRole } from '../middleware/authorize'
import { optionalAuth } from '../middleware/optional-authenticate'

const eventRouter = Router()
const organizerOnly = [requireAuth, requireRole('organizer', 'admin')]

eventRouter.get('/', optionalAuth, eventController.list)
eventRouter.get('/:id', optionalAuth, eventController.getOne)
eventRouter.post('/', ...organizerOnly, eventController.create)
eventRouter.patch('/:id', ...organizerOnly, eventController.update)
eventRouter.delete('/:id', ...organizerOnly, eventController.remove)
eventRouter.get('/:eventId/ticket-types', ticketTypeController.list)
eventRouter.post('/:eventId/ticket-types', ...organizerOnly, ticketTypeController.create)
eventRouter.patch('/:eventId/ticket-types/:ticketTypeId', ...organizerOnly, ticketTypeController.update)
eventRouter.delete('/:eventId/ticket-types/:ticketTypeId', ...organizerOnly, ticketTypeController.remove)

export default eventRouter
