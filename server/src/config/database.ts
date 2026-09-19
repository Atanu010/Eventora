import { Pool } from 'pg'
import { environment } from './env'

const pool = new Pool({
  connectionString: environment.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (error) => {
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', message: 'postgres_pool_error', error: error.message }))
})

export default pool
