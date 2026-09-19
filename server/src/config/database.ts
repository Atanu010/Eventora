import { Pool } from 'pg'
import { environment } from './env'

const pool = new Pool({
  connectionString: environment.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error)
})

export default pool
