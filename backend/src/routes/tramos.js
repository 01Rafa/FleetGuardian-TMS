import { Router } from 'express'
import { updateTramo, deleteTramo } from '../controllers/tramos.controller.js'

const router = Router()
router.put('/:id', updateTramo)
router.delete('/:id', deleteTramo)

export default router
