import { Router } from 'express'
import { login, register, refresh, logout, logoutAll, changePassword } from '../controllers/auth.controller.js'
import { jwtAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { loginSchema, registerSchema, changePasswordSchema } from '../schemas.js'
import { createLoginLimiter, createLoginEmailLimiters, createRegisterLimiter, createRefreshLimiter } from '../lib/rateLimits.js'

const router = Router()
router.post('/login', createLoginLimiter(), ...createLoginEmailLimiters(), validate(loginSchema), login)
router.post('/register', createRegisterLimiter(), validate(registerSchema), register)
router.post('/refresh', createRefreshLimiter(), refresh)
router.post('/logout', logout)
router.post('/logout-all', jwtAuth, logoutAll)
router.post('/change-password', jwtAuth, validate(changePasswordSchema), changePassword)

export default router
