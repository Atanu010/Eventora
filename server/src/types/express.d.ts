import type { AuthenticatedUser } from './request'

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser
      requestId?: string
    }
  }
}

export {}
