import { Router } from 'express'
import { initialize, verify } from '../controllers/payment.controller'
import { requireAuth } from '../middleware/authenticate'

const paymentRouter = Router()
paymentRouter.use(requireAuth)
paymentRouter.post('/orders/:id', initialize)
paymentRouter.post('/verify', verify)

export default paymentRouter