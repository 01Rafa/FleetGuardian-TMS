import { Router } from 'express'
import { uploadMiddleware, extractRateCon } from '../controllers/ratecon.controller.js'
import { createExtractLimiter } from '../lib/rateLimits.js'

const router = Router()
router.post('/extract', createExtractLimiter(), uploadMiddleware, extractRateCon)
export default router
