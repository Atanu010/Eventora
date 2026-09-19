import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import type { Express } from 'express'
import type { Pool } from 'pg'

process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev'
process.env.JWT_SECRET ??= 'phase11-security-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN ??= '1h'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.AUTH_RATE_LIMIT_MAX = '3'
process.env.SENSITIVE_RATE_LIMIT_MAX = '3'

let app: Express
let pool: Pool

before(async () => {
  ;({ default: app } = await import('../server/src/app'))
  ;({ default: pool } = await import('../server/src/config/database'))
})

after(async () => { await pool.end() })

describe('production hardening', () => {
  it('returns security headers and request correlation IDs', async () => {
    const supplied = 'security-test-request-1'
    const response = await request(app).get('/api/health').set('X-Request-Id', supplied)
    assert.equal(response.status, 200)
    assert.equal(response.headers['x-request-id'], supplied)
    assert.match(response.headers['content-security-policy'], /checkout\.razorpay\.com/)
    assert.equal(response.headers['x-content-type-options'], 'nosniff')
    assert.equal(response.headers['x-frame-options'], 'DENY')
    assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin')
    assert.match(response.headers['permissions-policy'], /camera=\(\)/)
  })

  it('allows configured CORS and rejects unexpected browser origins', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    assert.equal(allowed.status, 200)
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173')
    const denied = await request(app).get('/api/health').set('Origin', 'https://unexpected.example')
    assert.equal(denied.status, 403)
    assert.equal(denied.body.error.code, 'CORS_ORIGIN_DENIED')
  })

  it('returns controlled malformed JSON and payload-limit errors', async () => {
    const malformed = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":')
    assert.equal(malformed.status, 400)
    assert.equal(malformed.body.error.code, 'MALFORMED_JSON')
    const oversized = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send(JSON.stringify({ email: 'a'.repeat(2_000_000), password: 'x' }))
    assert.equal(oversized.status, 413)
    assert.equal(oversized.body.error.code, 'PAYLOAD_TOO_LARGE')
    assert.equal(typeof oversized.body.error.requestId, 'string')
  })

  it('throttles repeated authentication attempts', async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(app).post('/api/auth/login').send({ email: 'missing@example.test', password: 'wrong-password' })))
    assert.equal(responses.some((response) => response.status === 429), true)
    assert.equal(responses.find((response) => response.status === 429)?.body.error.code, 'RATE_LIMITED')
  })

  it('keeps health lightweight, readiness dependency-aware, and auth authorization intact', async () => {
    const health = await request(app).get('/api/health')
    const readiness = await request(app).get('/api/ready')
    const protectedResponse = await request(app).get('/api/admin/dashboard')
    assert.equal(health.body.status, 'ok')
    assert.equal(readiness.status, 200)
    assert.equal(readiness.body.dependencies.database, 'ok')
    assert.equal(protectedResponse.status, 401)
  })
})