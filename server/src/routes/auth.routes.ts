import { Router } from 'express'
import { login, me, register } from '../controllers/auth.controller'
import { requireAuth } from '../middleware/authenticate'

const authRouter = Router()

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.get('/me', requireAuth, me)

export default authRouter
