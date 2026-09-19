import { Router } from 'express'
import * as venueController from '../controllers/venue.controller'
import { requireAuth } from '../middleware/authenticate'
import { requireRole } from '../middleware/authorize'
import { optionalAuth } from '../middleware/optional-authenticate'

const venueRouter = Router()
const organizerOnly = [requireAuth, requireRole('organizer', 'admin')]

venueRouter.get('/', optionalAuth, venueController.list)
venueRouter.post('/', ...organizerOnly, venueController.create)
venueRouter.patch('/:id', ...organizerOnly, venueController.update)
venueRouter.delete('/:id', ...organizerOnly, venueController.remove)

export default venueRouter
