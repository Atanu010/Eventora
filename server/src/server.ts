import app from './app'
import pool from './config/database'
import { environment } from './config/env'
import { log } from './utils/logger'

const port = environment.port

const server = app.listen(port, () => {
  log('info', 'server_started', { port })
})

let shuttingDown = false
function shutdown(signal: string): void {
  if (shuttingDown) return
  shuttingDown = true
  log('info', 'server_shutdown_started', { signal })
  const timeout = setTimeout(() => { log('warn', 'server_shutdown_timeout'); process.exit(1) }, 10_000)
  server.close(() => { void pool.end().finally(() => { clearTimeout(timeout); log('info', 'server_shutdown_complete'); process.exit(0) }) })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
