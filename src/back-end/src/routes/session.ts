import { Router, type Request, type Response } from 'express'
import type { SessionManager } from '../engine/sessionManager'
import type { GameSession } from '../engine/session'

export function createSessionRouter(mgr: SessionManager): Router {
  const router = Router()

  function getSession(req: Request, res: Response): GameSession | null {
    const s = mgr.get(req.params.id)
    if (!s) {
      res.status(404).json({ error: 'SESSION_NOT_FOUND', message: `Session ${req.params.id} not found or expired`, code: 404 })
      return null
    }
    return s
  }

  router.post('/prepare', (req, res) => {
    const body = req.body ?? {}
    const session = mgr.create()
    try {
      const r = session.prepareLife({
        runCount: Number(body.run_count ?? 0),
        limitExpansion: Number(body.limit_expansion ?? 0),
      })
      res.json({
        session_id: session.id,
        seed: r.seed,
        world: r.world,
        character_name: r.characterName,
        talent_pool: r.talentPool,
        total_points: r.totalPoints,
        property_limits: r.propertyLimits,
        inheritance_pool: [], 
      })
    } catch (e) {
      res.status(500).json({ error: 'PREPARE_FAILED', message: (e as Error).message, code: 500 })
    }
  })

  router.post('/:id/select_talents', (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    const ids = Array.isArray(req.body?.talent_ids) ? req.body.talent_ids.map(Number) : []
    const r = s.selectTalents(ids)
    res.json({
      final_talent_ids: r.finalTalentIds,
      replacement_log: r.replacementLog,
      total_points: r.totalPoints,
      property_limits: r.propertyLimits,
    })
  })

  router.post('/:id/start', (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    const allocation = req.body?.allocation ?? {}
    res.json({ properties: s.start(allocation) })
  })

  router.post('/:id/next', (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    const r = s.next()
    res.json({
      age: r.age,
      content: r.content,
      is_end: r.isEnd,
      property_snapshot: r.propertySnapshot,
    })
  })

  router.get('/:id/summary', (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    const sum = s.getSummary()
    res.json({
      fate_summary: {
        seed: sum.seed,
        fate_level: sum.fateLevel,
        myth_count: sum.mythCount,
        sum: sum.sum,
        HAGE: sum.HAGE,
        HCHR: sum.HCHR,
        HINT: sum.HINT,
        HSTR: sum.HSTR,
        HMNY: sum.HMNY,
        HSPR: sum.HSPR,
        character_name: sum.characterName,
        world: s.getFateSummaryData().world,
      },
      life_summary_text: s.getLifeSummaryText(),
      title: s.getTitle(),
      traits: s.getTraits(),
    })
  })

  router.post('/:id/inscribe', (req, res) => {
    const s = getSession(req, res)
    if (!s) return
    res.json({ entry: s.inscribe() })
  })

  return router
}
