import { Router } from 'express'
import { listBrokers, createBroker } from '../controllers/brokers.controller.js'
import { validate } from '../middleware/validate.js'
import { createBrokerSchema } from '../schemas.js'

const router = Router()
router.get('/', listBrokers)
router.post('/', validate(createBrokerSchema), createBroker)

export default router
