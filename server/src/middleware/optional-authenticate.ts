import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../services/auth.service'

export function optionalAuth(request: Request, _response: Response, next: NextFunction): void {
  const authorization = request.header('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null

  if (token) {
    try {
      const claims = verifyAccessToken(token)
      request.authUser = { id: claims.sub, role: claims.role }
    } catch {
      // Invalid optional credentials are treated as anonymous for public reads.
    }
  }
  next()
}
