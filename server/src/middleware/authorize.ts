import type { NextFunction, Request, Response } from 'express'
import type { UserRole } from '../types/auth'

export function requireRole(...allowedRoles: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.authUser || !allowedRoles.includes(request.authUser.role)) {
      response.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' },
      })
      return
    }
    next()
  }
}
