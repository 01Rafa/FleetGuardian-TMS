import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const listNotificaciones = catchAsync(async (req, res) => {
  const empresaId = req.user.empresaId
  const [unread, read] = await Promise.all([
    prisma.notificacion.findMany({
      where: { empresaId, leida: false },
      orderBy: { creadoEn: 'desc' },
    }),
    prisma.notificacion.findMany({
      where: { empresaId, leida: true },
      orderBy: { creadoEn: 'desc' },
      take: 30,
    }),
  ])
  const all = [...unread, ...read].sort((a, b) => b.creadoEn - a.creadoEn)
  res.json(all)
})

export const countUnread = catchAsync(async (req, res) => {
  const count = await prisma.notificacion.count({
    where: { empresaId: req.user.empresaId, leida: false },
  })
  res.json({ unread: count })
})

export const marcarLeida = catchAsync(async (req, res) => {
  const notif = await prisma.notificacion.findFirst({
    where: { id: req.params.id, empresaId: req.user.empresaId },
  })
  if (!notif) return res.status(404).json({ error: 'Not found' })
  const updated = await prisma.notificacion.update({
    where: { id: req.params.id },
    data: { leida: true },
  })
  res.json(updated)
})

export const marcarTodasLeidas = catchAsync(async (req, res) => {
  await prisma.notificacion.updateMany({
    where: { empresaId: req.user.empresaId, leida: false },
    data: { leida: true },
  })
  res.json({ ok: true })
})
