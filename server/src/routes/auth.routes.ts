import { Router } from 'express'
import { login, me, register } from '../controllers/auth.controller'
import { requireAuth } from '../middleware/authenticate'
import { authRateLimiter } from '../middleware/rate-limiters'

const authRouter = Router()

authRouter.post('/register', authRateLimiter, register)
authRouter.post('/login', authRateLimiter, login)
authRouter.get('/me', requireAuth, me)

export default authRouter
