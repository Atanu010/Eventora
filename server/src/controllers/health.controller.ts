import type { Request, Response } from 'express'
import pool from '../config/database'

export async function getHealth(_request: Request, response: Response): Promise<void> {
  try {
    await pool.query('SELECT 1')
    response.json({
      status: 'ok',
      service: 'eventora-api',
    })
  } catch {
    response.status(503).json({
      status: 'error',
      service: 'eventora-api',
    })
  }
}
