import { Router } from 'express'
import { uploadMiddleware } from '../middleware/upload.js'
import { extractCdlDoc } from '../controllers/cdl.controller.js'
import { createExtractLimiter } from '../lib/rateLimits.js'

const router = Router()
router.post('/extract', createExtractLimiter(), uploadMiddleware, extractCdlDoc)
export default router
