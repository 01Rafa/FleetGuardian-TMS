import { Router } from 'express'
import { updateMantenimiento, deleteMantenimiento } from '../controllers/mantenimientos.controller.js'

const router = Router()
router.put('/:id', updateMantenimiento)
router.delete('/:id', deleteMantenimiento)
export default router
