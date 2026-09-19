import { processPendingNotifications } from '../services/notification.service'
import pool from '../config/database'

processPendingNotifications()
  .then((processed) => {
    console.log(`Processed ${processed} notification(s)`)
  })
  .catch((error: unknown) => {
    console.error('Notification processing failed')
    console.error(error instanceof Error ? error.message : 'Unknown error')
    process.exitCode = 1
  })
  .finally(() => pool.end())