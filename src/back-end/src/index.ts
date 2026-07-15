import './loadEnv' 
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { config } from './config'
import { DataStore } from './engine/dataLoader'
import { SessionManager } from './engine/sessionManager'
import { MockAIService } from './services/aiService'
import { PollutionService } from './services/pollution'
import { createGameRouter } from './routes/game'
import { pool, hasDb } from './db/pool'
import { listPollution } from './db/repos'
import type { Services } from './engine/session'

async function ensureSchema(): Promise<void> {
  if (!hasDb) return
  const sql = fs.readFileSync(path.join(__dirname, 'db/schema.sql'), 'utf-8')
  await pool!.query(sql)
  console.log('[backend] PostgreSQL schema ensured (schema.sql)')
}

async function hydratePollution(pollution: PollutionService): Promise<void> {
  const existing = await listPollution()
  for (const p of existing) pollution.add(p)
  console.log(`[backend] loaded ${existing.length} pollution pool entries from storage${existing.length ? '' : ' (cold start, empty until real inscriptions arrive)'}`)
}

async function main(): Promise<void> {
  await ensureSchema()

  const dataStore = new DataStore(config.dataDir, config.worldOrder)
  console.log('[backend] loading English data source...')
  const dataStoreEn = new DataStore(config.dataDirEn, config.worldOrder)
  const ai = new MockAIService()
  const pollution = new PollutionService(config.pollutionCap)
  await hydratePollution(pollution)

  const svc: Services = { dataStore, dataStoreEn, ai, pollution }
  const mgr = new SessionManager(svc)

  const app = express()
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }))
  app.use(express.json({ limit: '1mb' }))

  app.use((req, res, next) => {
    if (req.path === '/health') { next(); return }
    const start = Date.now()
    res.on('finish', () => {
      console.log(`[http:${req.params?.id ?? '-'}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`)
    })
    next()
  })

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      worlds: dataStore.available(),
      sessions: mgr.size,
      pollution: pollution.size,
      db: hasDb ? 'postgres' : 'memory',
      ai: config.ai.apiKey ? `claude:${config.ai.model}` : 'fallback',
    })
  })

  app.use('/', createGameRouter(mgr, pollution))

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[backend] error', err)
    res.status(500).json({ error: 'INTERNAL', message: err.message, code: 500 })
  })

  app.listen(config.port, () => {
    console.log(`[backend] listening on http://localhost:${config.port}`)
    console.log(`[backend] storage: ${hasDb ? 'PostgreSQL' : 'memory (data lost on restart)'}; AI: ${config.ai.apiKey ? config.ai.model : 'rule-based fallback'}`)
    console.log(`[backend] loaded worlds: ${dataStore.available().join(', ') || '(none)'}`)
  })
}

main().catch((e) => {
  console.error('[backend] startup failed', e)
  process.exit(1)
})
