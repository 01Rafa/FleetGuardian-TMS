import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const createPieza = catchAsync(async (req, res) => {
  const camion = await prisma.camion.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!camion) return res.status(404).json({ error: 'Camión not found' })
  const pieza = await prisma.pieza.create({ data: { ...req.body, camionId: req.params.id } })
  res.status(201).json(pieza)
})

export const updatePieza = catchAsync(async (req, res) => {
  const pieza = await prisma.pieza.findFirst({
    where: { id: req.params.id },
    include: { camion: { select: { empresaId: true } } },
  })
  if (!pieza || pieza.camion.empresaId !== req.user.empresaId) return res.status(404).json({ error: 'Pieza not found' })
  const updated = await prisma.pieza.update({ where: { id: req.params.id }, data: req.body })
  res.json(updated)
})

export const deletePieza = catchAsync(async (req, res) => {
  const pieza = await prisma.pieza.findFirst({
    where: { id: req.params.id },
    include: { camion: { select: { empresaId: true } } },
  })
  if (!pieza || pieza.camion.empresaId !== req.user.empresaId) return res.status(404).json({ error: 'Pieza not found' })
  await prisma.pieza.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})
