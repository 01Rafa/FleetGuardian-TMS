import { Router } from 'express'
import { listCamiones, getCamion, createCamion, updateCamion, deleteCamion } from '../controllers/camiones.controller.js'
import { createMantenimiento } from '../controllers/mantenimientos.controller.js'
import { createPieza } from '../controllers/piezas.controller.js'

const router = Router()
router.get('/', listCamiones)
router.post('/', createCamion)
router.get('/:id', getCamion)
router.put('/:id', updateCamion)
router.delete('/:id', deleteCamion)
router.post('/:id/mantenimientos', createMantenimiento)
router.post('/:id/piezas', createPieza)
export default router
