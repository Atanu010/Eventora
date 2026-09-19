import type { PoolClient } from 'pg'
import pool from '../config/database'

export interface NotificationView {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  status: 'pending' | 'delivered' | 'failed'
  read_at: string | null
  created_at: string
}

interface NotificationInput {
  userId: string
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
  dedupeKey: string
}

export async function enqueueNotification(client: PoolClient, input: NotificationInput): Promise<void> {
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, data, dedupe_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
    [input.userId, input.type, input.title, input.body, JSON.stringify(input.data ?? {}), input.dedupeKey],
  )
}

export async function listNotifications(userId: string, unreadOnly = false): Promise<NotificationView[]> {
  const result = await pool.query<NotificationView>(
    `SELECT id, type, title, body, data, status, read_at, created_at
     FROM notifications WHERE user_id = $1 ${unreadOnly ? 'AND read_at IS NULL' : ''}
     ORDER BY created_at DESC LIMIT 100`,
    [userId],
  )
  return result.rows.map(normalizeNotification)
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  const result = await pool.query(
    'UPDATE notifications SET read_at = COALESCE(read_at, NOW()), updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id',
    [notificationId, userId],
  )
  return Boolean(result.rows[0])
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await pool.query(
    'UPDATE notifications SET read_at = COALESCE(read_at, NOW()), updated_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
    [userId],
  )
  return result.rowCount ?? 0
}

export async function processPendingNotifications(limit = 50): Promise<number> {
  const client = await pool.connect()
  let processed = 0
  try {
    await client.query('BEGIN')
    const pending = await client.query<{ id: string }>(
      `SELECT id FROM notifications
       WHERE status IN ('pending', 'failed') AND next_attempt_at <= NOW() AND attempt_count < 5
       ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1`,
      [limit],
    )
    for (const row of pending.rows) {
      await client.query(
        `UPDATE notifications
         SET status = 'delivered', attempt_count = attempt_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [row.id],
      )
      processed += 1
    }
    await client.query('COMMIT')
    return processed
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function normalizeNotification(notification: NotificationView): NotificationView {
  return {
    ...notification,
    read_at: normalizeTimestamp(notification.read_at),
    created_at: normalizeTimestamp(notification.created_at)!,
  }
}

function normalizeTimestamp(value: string | Date | null): string | null {
  if (value instanceof Date) return value.toISOString()
  return value
}