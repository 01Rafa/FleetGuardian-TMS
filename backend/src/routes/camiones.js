import { Router } from 'express'
import { listCamiones, getCamion, createCamion, updateCamion, deleteCamion } from '../controllers/camiones.controller.js'
import { createMantenimiento } from '../controllers/mantenimientos.controller.js'
import { createPieza } from '../controllers/piezas.controller.js'
import { validate } from '../middleware/validate.js'
import { createCamionSchema, updateCamionSchema, createMantenimientoSchema, createPiezaSchema } from '../schemas.js'

const router = Router()
router.get('/', listCamiones)
router.post('/', validate(createCamionSchema), createCamion)
router.get('/:id', getCamion)
router.put('/:id', validate(updateCamionSchema), updateCamion)
router.delete('/:id', deleteCamion)
router.post('/:id/mantenimientos', validate(createMantenimientoSchema), createMantenimiento)
router.post('/:id/piezas', validate(createPiezaSchema), createPieza)
export default router
