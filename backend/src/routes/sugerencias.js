import { Router } from 'express'
import { getSugerencias } from '../controllers/sugerencias.controller.js'

const router = Router()
router.get('/', getSugerencias)
export default router
