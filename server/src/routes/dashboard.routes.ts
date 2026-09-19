import { Router } from 'express'
import { summary } from '../controllers/dashboard.controller'
import { requireAuth } from '../middleware/authenticate'
import { requireRole } from '../middleware/authorize'

const dashboardRouter = Router()
dashboardRouter.use(requireAuth, requireRole('organizer', 'admin'))
dashboardRouter.get('/summary', summary)

export default dashboardRouter