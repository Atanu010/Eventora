import { Router } from 'express'
import * as orderController from '../controllers/order.controller'
import { requireAuth } from '../middleware/authenticate'
import { initialize as initializePayment } from '../controllers/payment.controller'
import * as refundController from '../controllers/refund.controller'

const orderRouter = Router()

orderRouter.use(requireAuth)
orderRouter.post('/', orderController.create)
orderRouter.get('/', orderController.list)
orderRouter.get('/:id/tickets', orderController.tickets)
orderRouter.get('/:id', orderController.getOne)
orderRouter.post('/:id/cancel', orderController.cancel)
orderRouter.post('/:id/payment', initializePayment)
orderRouter.post('/:orderId/refund', refundController.create)
orderRouter.get('/:orderId/refunds', refundController.list)

export default orderRouter
