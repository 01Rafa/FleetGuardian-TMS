import { Router } from 'express'
import { listBrokers, createBroker } from '../controllers/brokers.controller.js'

const router = Router()
router.get('/', listBrokers)
router.post('/', createBroker)

export default router
