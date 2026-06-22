import { Router } from 'express'
import { listUsuarios, inviteUsuario, updateRol, deleteUsuario } from '../controllers/usuarios.controller.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'
import { inviteUsuarioSchema, updateRolSchema } from '../schemas.js'

const router = Router()
const adminOnly = requireRole('admin')

router.get('/', adminOnly, listUsuarios)
router.post('/', adminOnly, validate(inviteUsuarioSchema), inviteUsuario)
router.patch('/:id/rol', adminOnly, validate(updateRolSchema), updateRol)
router.delete('/:id', adminOnly, deleteUsuario)

export default router
