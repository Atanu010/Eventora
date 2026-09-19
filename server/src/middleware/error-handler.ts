import type { ErrorRequestHandler } from 'express'
import { environment } from '../config/env'
import { log } from '../utils/logger'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors'

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = request.requestId
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message, requestId },
    })
    return
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        fields: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        requestId,
      },
    })
    return
  }

  if (error?.type === 'entity.too.large') {
    response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload is too large', requestId } })
    return
  }
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON', requestId } })
    return
  }
  log('error', 'unhandled_api_error', { requestId, method: request.method, route: request.originalUrl, error: environment.nodeEnv === 'production' ? 'internal_error' : error instanceof Error ? error.message : 'unknown_error' })
  response.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred', requestId },
  })
}
