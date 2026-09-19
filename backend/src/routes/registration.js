import { Router } from 'express'
import { uploadMiddleware } from '../middleware/upload.js'
import { extractRegistrationDoc } from '../controllers/registration.controller.js'

const router = Router()
router.post('/extract', uploadMiddleware, extractRegistrationDoc)
export default router
