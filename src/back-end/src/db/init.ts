import '../loadEnv' 
import fs from 'fs'
import path from 'path'
import { pool, hasDb } from './pool'

async function main(): Promise<void> {
  if (!hasDb) {
    console.error('DATABASE_URL not configured, nothing to initialize (runtime will use the in-memory store).')
    process.exit(1)
  }
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')
  await pool!.query(sql)
  console.log('schema.sql applied successfully')
  await pool!.end()
}

main().catch((e) => {
  console.error('DB initialization failed:', e)
  process.exit(1)
})
