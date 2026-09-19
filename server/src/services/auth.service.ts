import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { getJwtConfiguration } from '../config/env'
import { AppError, ConflictError } from '../utils/errors'
import { createUser, findUserByEmail, findUserById } from '../repositories/user.repository'
import type { JwtClaims, SafeUser, UserRecord } from '../types/auth'

export function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }
}

export async function registerUser(name: string, email: string, password: string): Promise<SafeUser> {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
  const user = await createUser(name, email, passwordHash)
  return toSafeUser(user)
}

export async function authenticateUser(email: string, password: string): Promise<SafeUser | null> {
  const user = await findUserByEmail(email)
  if (!user || !(await argon2.verify(user.password_hash, password))) {
    return null
  }
  return toSafeUser(user)
}

export function createAccessToken(user: SafeUser): string {
  const jwtConfiguration = getJwtConfiguration()
  return jwt.sign(
    { sub: user.id, role: user.role },
    jwtConfiguration.secret,
    { expiresIn: jwtConfiguration.expiresIn, algorithm: 'HS256' },
  )
}

export function verifyAccessToken(token: string): JwtClaims {
  const payload = jwt.verify(token, getJwtConfiguration().secret, { algorithms: ['HS256'] })
  if (!isJwtClaims(payload)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required')
  }
  return payload
}

export async function findAuthenticatedUser(id: string): Promise<SafeUser | null> {
  const user = await findUserById(id)
  return user ? toSafeUser(user) : null
}

function isJwtClaims(payload: string | jwt.JwtPayload): payload is jwt.JwtPayload & JwtClaims {
  return typeof payload !== 'string'
    && typeof payload.sub === 'string'
    && isUserRole(payload.role)
}

function isUserRole(role: unknown): role is JwtClaims['role'] {
  return role === 'attendee' || role === 'organizer' || role === 'admin'
}
