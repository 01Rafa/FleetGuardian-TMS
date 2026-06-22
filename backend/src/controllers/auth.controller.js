import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { signAccess, signRefresh, verifyRefresh } from '../lib/jwt.js'
import { catchAsync } from '../middleware/errorHandler.js'

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'none',
  secure: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function userShape(u) {
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, mustChangePassword: u.mustChangePassword ?? false }
}

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  const user = await prisma.usuario.findUnique({ where: { email }, select: { id: true, nombre: true, email: true, rol: true, empresaId: true, password: true, mustChangePassword: true } })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const payload = { userId: user.id, empresaId: user.empresaId, rol: user.rol }
  const accessToken = signAccess(payload)
  const refreshToken = signRefresh(payload)

  res.cookie('refreshToken', refreshToken, COOKIE_OPTS)
  res.json({ accessToken, user: userShape(user) })
})

export const register = catchAsync(async (req, res) => {
  const { empresa: empresaData, usuario: usuarioData } = req.body

  if (!empresaData?.nombre?.trim()) return res.status(400).json({ error: 'Company name is required' })
  if (!usuarioData?.nombre?.trim()) return res.status(400).json({ error: 'Full name is required' })
  if (!usuarioData?.email?.trim()) return res.status(400).json({ error: 'Email is required' })
  if (!usuarioData?.password) return res.status(400).json({ error: 'Password is required' })
  if (usuarioData.password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
  if (usuarioData.password !== usuarioData.confirmPassword) return res.status(400).json({ error: 'Passwords do not match' })

  const existing = await prisma.usuario.findUnique({ where: { email: usuarioData.email } })
  if (existing) return res.status(409).json({ error: 'Email already in use' })

  const hashed = await bcrypt.hash(usuarioData.password, 10)

  const result = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      data: {
        nombre: empresaData.nombre.trim(),
        dotNumber: empresaData.dotNumber?.trim() || null,
        phone: empresaData.phone?.trim() || null,
      },
    })
    const usuario = await tx.usuario.create({
      data: {
        empresaId: empresa.id,
        nombre: usuarioData.nombre.trim(),
        email: usuarioData.email.trim().toLowerCase(),
        password: hashed,
        rol: 'admin',
      },
    })
    return { empresa, usuario }
  })

  const payload = { userId: result.usuario.id, empresaId: result.empresa.id, rol: 'admin' }
  const accessToken = signAccess(payload)
  const refreshToken = signRefresh(payload)

  res.cookie('refreshToken', refreshToken, COOKIE_OPTS)
  res.status(201).json({ accessToken, user: userShape(result.usuario) })
})

export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken
  if (!token) return res.status(401).json({ error: 'No refresh token' })

  let payload
  try {
    payload = verifyRefresh(token)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' })
  }

  const user = await prisma.usuario.findUnique({
    where: { id: payload.userId },
    select: { id: true, nombre: true, email: true, rol: true, empresaId: true, mustChangePassword: true },
  })
  if (!user) return res.status(401).json({ error: 'User not found' })

  const accessToken = signAccess({ userId: user.id, empresaId: user.empresaId, rol: user.rol })
  res.json({ accessToken, user: userShape(user) })
})

export const logout = catchAsync(async (req, res) => {
  res.clearCookie('refreshToken', COOKIE_OPTS)
  res.json({ ok: true })
})

export const changePassword = catchAsync(async (req, res) => {
  const { password, confirmPassword } = req.body
  if (!password) return res.status(400).json({ error: 'Password is required' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
  if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' })

  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.usuario.update({
    where: { id: req.user.userId },
    data: { password: hashed, mustChangePassword: false },
    select: { id: true, nombre: true, email: true, rol: true, mustChangePassword: true },
  })
  res.json({ user: userShape(user) })
})
