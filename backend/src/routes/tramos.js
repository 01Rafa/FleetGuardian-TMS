import { Router } from 'express'
import { updateTramo, deleteTramo } from '../controllers/tramos.controller.js'
import { validate } from '../middleware/validate.js'
import { updateTramoSchema } from '../schemas.js'

const router = Router()
router.put('/:id', validate(updateTramoSchema), updateTramo)
router.delete('/:id', deleteTramo)

export default router
