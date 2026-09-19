import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors'

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
    })
    return
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        fields: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      },
    })
    return
  }

  console.error('Unhandled API error')
  response.status(500).json({
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
  })
}
