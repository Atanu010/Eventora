import type { PoolClient } from 'pg'
import pool from '../config/database'
import type { UserRecord, UserRole } from '../types/auth'
import { ConflictError } from '../utils/errors'

const userColumns = 'id, name, email, password_hash, role'

type QueryExecutor = typeof pool | PoolClient

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT ${userColumns} FROM users WHERE email = $1`,
    [email],
  )
  return result.rows[0] ?? null
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT ${userColumns} FROM users WHERE id = $1`,
    [id],
  )
  return result.rows[0] ?? null
}

export async function createUser(
  name: string,
  email: string,
  passwordHash: string,
  role: UserRole = 'attendee',
  executor: QueryExecutor = pool,
): Promise<UserRecord> {
  try {
    const result = await executor.query<UserRecord>(
      `
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING ${userColumns}
      `,
      [name, email, passwordHash, role],
    )
    return result.rows[0]
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('An account with that email already exists')
    }
    throw error
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
