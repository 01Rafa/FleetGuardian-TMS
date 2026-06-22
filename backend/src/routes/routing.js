import { Router } from 'express'
import { getDistance } from '../controllers/routing.controller.js'

const router = Router()
router.get('/distance', getDistance)

export default router
