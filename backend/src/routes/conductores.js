import { Router } from 'express'
import { listConductores, getConductor, createConductor, updateConductor, deleteConductor } from '../controllers/conductores.controller.js'

const router = Router()
router.get('/', listConductores)
router.post('/', createConductor)
router.get('/:id', getConductor)
router.put('/:id', updateConductor)
router.delete('/:id', deleteConductor)
export default router
