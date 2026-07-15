import { Pool } from 'pg'
import { config } from '../config'

function sslOption(url: string): false | { rejectUnauthorized: boolean } {
  if (process.env.PGSSL === 'disable') return false
  if (/localhost|127\.0\.0\.1/.test(url)) return false
  return { rejectUnauthorized: false }
}

export const pool: Pool | null = config.databaseUrl
  ? new Pool({ connectionString: config.databaseUrl, max: 10, ssl: sslOption(config.databaseUrl) })
  : null

export const hasDb = pool != null
