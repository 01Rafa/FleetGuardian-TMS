import prisma from '../lib/prisma.js'
import { recalcularVuelta } from '../lib/recalcularVuelta.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const createGasto = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.id, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  const gasto = await prisma.gasto.create({ data: { ...req.body, vueltaId: req.params.id } })
  await recalcularVuelta(req.params.id)
  res.status(201).json(gasto)
})

export const updateGasto = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const gasto = await prisma.gasto.findFirst({
    where: { id: req.params.id },
    include: { vuelta: { select: { empresaId: true } } },
  })
  if (!gasto || gasto.vuelta.empresaId !== empresaId) return res.status(404).json({ error: 'Gasto not found' })
  const updated = await prisma.gasto.update({ where: { id: req.params.id }, data: req.body })
  await recalcularVuelta(gasto.vueltaId)
  res.json(updated)
})

export const deleteGasto = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const gasto = await prisma.gasto.findFirst({
    where: { id: req.params.id },
    include: { vuelta: { select: { empresaId: true } } },
  })
  if (!gasto || gasto.vuelta.empresaId !== empresaId) return res.status(404).json({ error: 'Gasto not found' })
  await prisma.gasto.delete({ where: { id: req.params.id } })
  await recalcularVuelta(gasto.vueltaId)
  res.json({ ok: true })
})
