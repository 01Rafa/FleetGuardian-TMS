import { Router } from 'express'
import { getCacheStats } from '../controllers/admin.controller.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()
router.get('/cache-stats', requireRole('admin'), getCacheStats)

export default router
