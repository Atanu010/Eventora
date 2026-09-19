import fs from 'node:fs'
import path from 'node:path'
import pool from '../config/database'

const migrationsDirectory = path.resolve(__dirname, '../../../database/migrations')

async function migrate(): Promise<void> {
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const migrationFiles = fs
      .readdirSync(migrationsDirectory)
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort()

    for (const fileName of migrationFiles) {
      const version = fileName.split('_', 1)[0]
      const applied = await client.query<{ version: string }>(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version],
      )

      if (applied.rowCount) {
        console.log(`Skipping applied migration ${fileName}`)
        continue
      }

      const migrationSql = fs.readFileSync(path.join(migrationsDirectory, fileName), 'utf8')
      console.log(`Applying migration ${fileName}`)

      await client.query('BEGIN')
      try {
        await client.query(migrationSql)
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [version, fileName],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${fileName} failed`, { cause: error })
      }
    }

    console.log('Database migrations complete')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
