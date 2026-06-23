import { Router } from 'express'
import { uploadMiddleware, extractRateCon } from '../controllers/ratecon.controller.js'

const router = Router()
router.post('/extract', uploadMiddleware, extractRateCon)
export default router
