import type { Request, Response } from 'express'
import pool from '../config/database'

export async function getHealth(_request: Request, response: Response): Promise<void> {
  response.json({ status: 'ok', service: 'eventora-api' })
}

export async function getReadiness(_request: Request, response: Response): Promise<void> {
  try { await pool.query('SELECT 1'); response.json({ status: 'ready', dependencies: { database: 'ok' } }) }
  catch { response.status(503).json({ status: 'not_ready', dependencies: { database: 'unavailable' } }) }
}
