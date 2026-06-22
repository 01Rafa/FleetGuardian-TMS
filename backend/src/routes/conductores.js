import { Router } from 'express'
import { listConductores, getConductor, createConductor, updateConductor, deleteConductor } from '../controllers/conductores.controller.js'
import { validate } from '../middleware/validate.js'
import { createConductorSchema, updateConductorSchema } from '../schemas.js'

const router = Router()
router.get('/', listConductores)
router.post('/', validate(createConductorSchema), createConductor)
router.get('/:id', getConductor)
router.put('/:id', validate(updateConductorSchema), updateConductor)
router.delete('/:id', deleteConductor)
export default router
