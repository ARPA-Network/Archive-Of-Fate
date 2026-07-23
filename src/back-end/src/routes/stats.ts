import { Router, type Request, type Response } from 'express'
import { getUserStats, USER_STATS_WINDOWS } from '../db/repos'
import { rpcPoolStatus } from '../services/chainVerifier'

export function createStatsRouter(): Router {
  const router = Router()

  router.get('/admin/rpc/status', (_req: Request, res: Response) => {
    res.json({ endpoints: rpcPoolStatus() })
  })

  router.get('/admin/stats/users', async (req: Request, res: Response) => {
    const window = req.query.window as string | undefined
    if (window && !(window in USER_STATS_WINDOWS)) {
      res.status(400).json({
        error: 'BAD_REQUEST',
        message: `window must be one of: ${Object.keys(USER_STATS_WINDOWS).join(', ')}`,
        code: 400,
      })
      return
    }
    try {
      const stats = await getUserStats(window)
      res.json({ total_users: stats.totalUsers, active_users: stats.activeUsers })
    } catch (e) {
      console.error('[stats] error', e)
      res.status(500).json({ error: 'INTERNAL_ERROR', message: (e as Error).message, code: 500 })
    }
  })

  return router
}
