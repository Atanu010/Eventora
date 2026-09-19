import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { after, before, describe, it } from 'node:test'
import request from 'supertest'
import type { Express, Request, Response } from 'express'
import type { Pool } from 'pg'
import { requireRole } from '../server/src/middleware/authorize'

const serverRequire = createRequire(`${process.cwd()}/server/package.json`)
const jwt = serverRequire('jsonwebtoken') as {
  sign: (payload: object, secret: string, options: object) => string
}

process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL ?? 'postgresql://eventora_dev:eventora_dev_password@localhost:5432/eventora_dev'
process.env.JWT_SECRET ??= 'phase3-test-secret-that-is-at-least-32-characters-long'
process.env.JWT_EXPIRES_IN ??= '1h'

let app: Express
let pool: Pool

const testEmail = `phase3-test-${Date.now()}@example.test`
const testPassword = 'phase3-strong-password'
let accessToken = ''

before(async () => {
  ;({ default: app } = await import('../server/src/app'))
  ;({ default: pool } = await import('../server/src/config/database'))
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['phase3-%@example.test'])
})

after(async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', ['phase3-%@example.test'])
  await pool.end()
})

describe('registration', () => {
  it('registers a valid user with the attendee role', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Phase Three Test User',
      email: testEmail,
      password: testPassword,
    })

    assert.equal(response.status, 201)
    assert.equal(response.body.user.email, testEmail)
    assert.equal(response.body.user.role, 'attendee')
    assert.equal(response.body.user.password_hash, undefined)
  })

  it('normalizes email addresses', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Normalized Test User',
      email: ' PHASE3-NORMALIZED@EXAMPLE.TEST ',
      password: testPassword,
    })

    assert.equal(response.status, 201)
    assert.equal(response.body.user.email, 'phase3-normalized@example.test')
  })

  it('rejects invalid email and password input', async () => {
    const invalidEmail = await request(app).post('/api/auth/register').send({
      name: 'Invalid Email',
      email: 'not-an-email',
      password: testPassword,
    })
    const invalidPassword = await request(app).post('/api/auth/register').send({
      name: 'Invalid Password',
      email: 'invalid-password@example.test',
      password: 'short',
    })

    assert.equal(invalidEmail.status, 400)
    assert.equal(invalidPassword.status, 400)
  })

  it('rejects duplicate email addresses', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Duplicate Test User',
      email: testEmail,
      password: testPassword,
    })

    assert.equal(response.status, 409)
  })
})

describe('login and authentication', () => {
  it('logs in with valid credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: testEmail.toUpperCase(),
      password: testPassword,
    })

    assert.equal(response.status, 200)
    assert.equal(typeof response.body.accessToken, 'string')
    assert.equal(response.body.user.role, 'attendee')
    assert.equal(response.body.user.password_hash, undefined)
    accessToken = response.body.accessToken
  })

  it('rejects invalid passwords and unknown emails without leaking account existence', async () => {
    const invalidPassword = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'incorrect-password',
    })
    const unknownEmail = await request(app).post('/api/auth/login').send({
      email: 'unknown@example.test',
      password: 'incorrect-password',
    })

    assert.equal(invalidPassword.status, 401)
    assert.equal(unknownEmail.status, 401)
    assert.equal(invalidPassword.body.error.code, unknownEmail.body.error.code)
    assert.equal(invalidPassword.body.error.message, unknownEmail.body.error.message)
    assert.notEqual(invalidPassword.body.error.requestId, unknownEmail.body.error.requestId)
  })

  it('rejects missing, invalid, and expired tokens', async () => {
    const missing = await request(app).get('/api/auth/me')
    const invalid = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid-token')
    const expiredToken = jwt.sign(
      { sub: '00000000-0000-0000-0000-000000000000', role: 'attendee' },
      process.env.JWT_SECRET!,
      { expiresIn: -1, algorithm: 'HS256' },
    )
    const expired = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expiredToken}`)

    assert.equal(missing.status, 401)
    assert.equal(invalid.status, 401)
    assert.equal(expired.status, 401)
  })

  it('returns the authenticated current user', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`)

    assert.equal(response.status, 200)
    assert.deepEqual(response.body, {
      id: response.body.id,
      name: 'Phase Three Test User',
      email: testEmail,
      role: 'attendee',
    })
    assert.equal(response.body.password_hash, undefined)
  })
})

describe('role authorization', () => {
  function evaluate(role: 'attendee' | 'organizer' | 'admin', allowed: Array<'attendee' | 'organizer' | 'admin'>) {
    let statusCode = 200
    let nextCalled = false
    const response = {
      status(code: number) {
        statusCode = code
        return response
      },
      json() {
        return response
      },
    } as unknown as Response
    const requestContext = { authUser: { id: 'test-user', role } } as Request

    requireRole(...allowed)(requestContext, response, () => {
      nextCalled = true
    })

    return { statusCode, nextCalled }
  }

  it('allows attendee, organizer, and admin roles when permitted', () => {
    assert.equal(evaluate('attendee', ['attendee']).nextCalled, true)
    assert.equal(evaluate('organizer', ['organizer']).nextCalled, true)
    assert.equal(evaluate('admin', ['admin']).nextCalled, true)
  })

  it('rejects a role that is not permitted', () => {
    const result = evaluate('attendee', ['organizer', 'admin'])
    assert.equal(result.statusCode, 403)
    assert.equal(result.nextCalled, false)
  })
})
