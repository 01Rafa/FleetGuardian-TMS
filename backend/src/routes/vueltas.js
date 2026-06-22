import { Router } from 'express'
import { listVueltas, createVuelta, getVuelta, updateVuelta, deleteVuelta, changeEstado, mergeVueltas } from '../controllers/vueltas.controller.js'
import { createTramo } from '../controllers/tramos.controller.js'
import { createGasto } from '../controllers/gastos.controller.js'
import { validate } from '../middleware/validate.js'
import { createVueltaSchema, updateVueltaSchema, changeEstadoSchema, mergeVueltasSchema, createTramoSchema, createGastoSchema } from '../schemas.js'

const router = Router()
router.get('/', listVueltas)
router.post('/', validate(createVueltaSchema), createVuelta)
router.post('/merge', validate(mergeVueltasSchema), mergeVueltas)
router.get('/:id', getVuelta)
router.put('/:id', validate(updateVueltaSchema), updateVuelta)
router.delete('/:id', deleteVuelta)
router.patch('/:id/estado', validate(changeEstadoSchema), changeEstado)
router.post('/:id/tramos', validate(createTramoSchema), createTramo)
router.post('/:id/gastos', validate(createGastoSchema), createGasto)

export default router
