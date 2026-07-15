import { Router } from 'express'
import type { RegistryService } from '../services/registry'
import type { PollutionService } from '../services/pollution'

export function createRegistryRouter(registry: RegistryService, pollution: PollutionService): Router {
  const router = Router()

  router.get('/registry/list', (_req, res) => {
    res.json({ entries: registry.list() })
  })

  router.get('/pollution/pool', (_req, res) => {
    res.json({ entries: pollution.list(), size: pollution.size })
  })

  return router
}
