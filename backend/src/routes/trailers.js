import { Router } from 'express'
import { listTrailers, getTrailer, createTrailer, updateTrailer, deleteTrailer } from '../controllers/trailers.controller.js'
import { createTrailerMantenimiento } from '../controllers/mantenimientos.controller.js'
import { createTrailerPieza } from '../controllers/piezas.controller.js'
import { validate } from '../middleware/validate.js'
import { createTrailerSchema, updateTrailerSchema, createMantenimientoSchema, createPiezaSchema } from '../schemas.js'

const router = Router()
router.get('/', listTrailers)
router.post('/', validate(createTrailerSchema), createTrailer)
router.get('/:id', getTrailer)
router.put('/:id', validate(updateTrailerSchema), updateTrailer)
router.delete('/:id', deleteTrailer)
router.post('/:id/mantenimientos', validate(createMantenimientoSchema), createTrailerMantenimiento)
router.post('/:id/piezas', validate(createPiezaSchema), createTrailerPieza)
export default router
