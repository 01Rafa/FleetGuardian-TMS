import { Router } from 'express'
import { updatePieza, deletePieza } from '../controllers/piezas.controller.js'

const router = Router()
router.put('/:id', updatePieza)
router.delete('/:id', deletePieza)
export default router
