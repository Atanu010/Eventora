import type { NextFunction, Request, Response } from 'express'
import { verifyAccessToken } from '../services/auth.service'

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const authorization = request.header('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : null

  if (!token) {
    response.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
    return
  }

  try {
    const claims = verifyAccessToken(token)
    request.authUser = { id: claims.sub, role: claims.role }
    next()
  } catch {
    response.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
  }
}
