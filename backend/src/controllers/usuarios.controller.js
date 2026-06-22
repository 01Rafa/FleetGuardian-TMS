import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

const TEMP_PASSWORD = 'Welcome2025!'
const VALID_ROLES = ['admin', 'dispatcher', 'viewer']

const userShape = u => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, creadoEn: u.creadoEn })

export const listUsuarios = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const users = await prisma.usuario.findMany({
    where: { empresaId },
    select: { id: true, nombre: true, email: true, rol: true, creadoEn: true },
    orderBy: { creadoEn: 'asc' },
  })
  res.json(users)
})

export const inviteUsuario = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const { nombre, email, rol } = req.body

  if (!nombre?.trim()) return res.status(400).json({ error: 'Name is required' })
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' })
  if (!VALID_ROLES.includes(rol)) return res.status(400).json({ error: 'Invalid role' })

  const existing = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return res.status(409).json({ error: 'Email already in use' })

  const hashed = await bcrypt.hash(TEMP_PASSWORD, 10)
  const user = await prisma.usuario.create({
    data: { empresaId, nombre: nombre.trim(), email: email.trim().toLowerCase(), password: hashed, rol, mustChangePassword: true },
    select: { id: true, nombre: true, email: true, rol: true, creadoEn: true },
  })

  res.status(201).json({ ...userShape(user), tempPassword: TEMP_PASSWORD })
})

export const updateRol = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const { rol } = req.body

  if (!VALID_ROLES.includes(rol)) return res.status(400).json({ error: 'Invalid role' })

  const user = await prisma.usuario.findFirst({ where: { id: req.params.id, empresaId } })
  if (!user) return res.status(404).json({ error: 'User not found' })

  const updated = await prisma.usuario.update({
    where: { id: req.params.id },
    data: { rol },
    select: { id: true, nombre: true, email: true, rol: true, creadoEn: true },
  })
  res.json(userShape(updated))
})

export const deleteUsuario = catchAsync(async (req, res) => {
  const { empresaId, userId } = req.user

  if (req.params.id === userId) return res.status(400).json({ error: 'Cannot delete yourself' })

  const user = await prisma.usuario.findFirst({ where: { id: req.params.id, empresaId } })
  if (!user) return res.status(404).json({ error: 'User not found' })

  await prisma.usuario.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})
