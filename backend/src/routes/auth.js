import { Router } from 'express'
import { login, register, refresh, logout } from '../controllers/auth.controller.js'

const router = Router()
router.post('/login', login)
router.post('/register', register)
router.post('/refresh', refresh)
router.post('/logout', logout)

export default router
