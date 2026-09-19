import { Router } from 'express'
import * as admin from '../controllers/admin.controller'
import { requireAuth } from '../middleware/authenticate'
import { requireRole } from '../middleware/authorize'
import { create as createRefund } from '../controllers/refund.controller'

const router = Router()
router.use(requireAuth, requireRole('admin'))
router.get('/dashboard', admin.dashboard)
router.get('/users', admin.users)
router.get('/users/:id', admin.user)
router.patch('/users/:id/role', admin.role)
router.get('/events', admin.events)
router.get('/events/:id', admin.event)
router.patch('/events/:id/status', admin.moderate)
router.get('/orders', admin.orders)
router.get('/tickets', admin.tickets)
router.get('/audit-logs', admin.auditLogs)
router.post('/orders/:orderId/refund', createRefund)
export default router