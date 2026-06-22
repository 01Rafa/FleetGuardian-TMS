import { Router } from 'express'
import { login, register, refresh, logout, changePassword } from '../controllers/auth.controller.js'
import { jwtAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, registerSchema, changePasswordSchema } from '../schemas.js'

const router = Router()
router.post('/login', validate(loginSchema), login)
router.post('/register', validate(registerSchema), register)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.post('/change-password', jwtAuth, validate(changePasswordSchema), changePassword)

export default router
