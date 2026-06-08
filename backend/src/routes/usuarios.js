import { Router } from 'express'
import { listUsuarios, inviteUsuario, updateRol, deleteUsuario } from '../controllers/usuarios.controller.js'
import { requireRole } from '../middleware/requireRole.js'

const router = Router()
const adminOnly = requireRole('admin')

router.get('/', adminOnly, listUsuarios)
router.post('/', adminOnly, inviteUsuario)
router.patch('/:id/rol', adminOnly, updateRol)
router.delete('/:id', adminOnly, deleteUsuario)

export default router
