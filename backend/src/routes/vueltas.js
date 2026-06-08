import { Router } from 'express'
import { listVueltas, createVuelta, getVuelta, updateVuelta, deleteVuelta, changeEstado, mergeVueltas } from '../controllers/vueltas.controller.js'
import { createTramo } from '../controllers/tramos.controller.js'
import { createGasto } from '../controllers/gastos.controller.js'

const router = Router()
router.get('/', listVueltas)
router.post('/', createVuelta)
router.post('/merge', mergeVueltas)
router.get('/:id', getVuelta)
router.put('/:id', updateVuelta)
router.delete('/:id', deleteVuelta)
router.patch('/:id/estado', changeEstado)
router.post('/:id/tramos', createTramo)
router.post('/:id/gastos', createGasto)

export default router
