import { Router } from 'express'
import { updateGasto, deleteGasto } from '../controllers/gastos.controller.js'
import { validate } from '../middleware/validate.js'
import { updateGastoSchema } from '../schemas.js'

const router = Router()
router.put('/:id', validate(updateGastoSchema), updateGasto)
router.delete('/:id', deleteGasto)

export default router
