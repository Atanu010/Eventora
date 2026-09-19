import app from './app'
import pool from './config/database'

const port = Number(process.env.PORT ?? 3000)

const server = app.listen(port, () => {
  console.log(`Eventora API listening on port ${port}`)
})

function shutdown(signal: string): void {
  console.log(`Received ${signal}; shutting down`)
  server.close(() => {
    void pool.end().finally(() => process.exit(0))
  })
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
