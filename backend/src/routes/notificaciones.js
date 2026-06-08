import { Router } from 'express'
import { listNotificaciones, countUnread, marcarLeida, marcarTodasLeidas } from '../controllers/notificaciones.controller.js'

const router = Router()
router.get('/', listNotificaciones)
router.get('/count', countUnread)
router.patch('/leer-todas', marcarTodasLeidas)
router.patch('/:id/leer', marcarLeida)
export default router
