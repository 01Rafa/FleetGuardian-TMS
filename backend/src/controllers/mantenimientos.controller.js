import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

const parseDate = (v) => (v ? new Date(v) : undefined)

export const createMantenimiento = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const camion = await prisma.camion.findFirst({ where: { id: req.params.id, empresaId } })
  if (!camion) return res.status(404).json({ error: 'Camión not found' })
  const { tipo, descripcion, costo, proveedor, fecha, proximoMantenimiento } = req.body
  const m = await prisma.mantenimiento.create({
    data: {
      camionId: req.params.id,
      tipo,
      descripcion,
      costo: Number(costo ?? 0),
      proveedor: proveedor || null,
      fecha: new Date(fecha),
      proximoMantenimiento: parseDate(proximoMantenimiento),
    },
  })
  res.status(201).json(m)
})

export const updateMantenimiento = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const m = await prisma.mantenimiento.findFirst({ where: { id: req.params.id }, include: { camion: { select: { empresaId: true } } } })
  if (!m || m.camion.empresaId !== empresaId) return res.status(404).json({ error: 'Not found' })
  const { tipo, descripcion, costo, proveedor, fecha, proximoMantenimiento } = req.body
  const updated = await prisma.mantenimiento.update({
    where: { id: req.params.id },
    data: {
      ...(tipo ? { tipo } : {}),
      ...(descripcion ? { descripcion } : {}),
      ...(costo !== undefined ? { costo: Number(costo) } : {}),
      proveedor: proveedor ?? m.proveedor,
      ...(fecha ? { fecha: new Date(fecha) } : {}),
      proximoMantenimiento: proximoMantenimiento !== undefined ? parseDate(proximoMantenimiento) : m.proximoMantenimiento,
    },
  })
  res.json(updated)
})

export const deleteMantenimiento = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const m = await prisma.mantenimiento.findFirst({ where: { id: req.params.id }, include: { camion: { select: { empresaId: true } } } })
  if (!m || m.camion.empresaId !== empresaId) return res.status(404).json({ error: 'Not found' })
  await prisma.mantenimiento.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})
