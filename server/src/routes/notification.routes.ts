import { Router } from 'express'
import * as notificationController from '../controllers/notification.controller'
import { requireAuth } from '../middleware/authenticate'

const notificationRouter = Router()
notificationRouter.use(requireAuth)
notificationRouter.get('/', notificationController.list)
notificationRouter.post('/read-all', notificationController.markAllRead)
notificationRouter.post('/:id/read', notificationController.markRead)

export default notificationRouter