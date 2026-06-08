import { Router } from 'express'
import { updateGasto, deleteGasto } from '../controllers/gastos.controller.js'

const router = Router()
router.put('/:id', updateGasto)
router.delete('/:id', deleteGasto)

export default router
