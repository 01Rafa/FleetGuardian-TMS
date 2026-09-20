import { Router } from 'express'
import { uploadMiddleware } from '../middleware/upload.js'
import { extractRegistrationDoc } from '../controllers/registration.controller.js'
import { createExtractLimiter } from '../lib/rateLimits.js'

const router = Router()
router.post('/extract', createExtractLimiter(), uploadMiddleware, extractRegistrationDoc)
export default router
