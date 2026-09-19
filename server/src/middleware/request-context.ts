import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { log } from '../utils/logger'

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/

export function requestContext(request: Request, response: Response, next: NextFunction): void {
  const supplied = request.header('x-request-id')
  const requestId = supplied && requestIdPattern.test(supplied) ? supplied : randomUUID()
  request.requestId = requestId
  response.setHeader('X-Request-Id', requestId)
  const started = process.hrtime.bigint()
  response.on('finish', () => log('info', 'http_request', { requestId, method: request.method, route: request.originalUrl, statusCode: response.statusCode, durationMs: Number(process.hrtime.bigint() - started) / 1_000_000 }))
  next()
}