import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'
import { belongsToEmpresa } from '../lib/ownership.js'

const parseDate = (v) => (v ? new Date(v) : undefined)

const OWNER_INCLUDE = {
  camion: { select: { empresaId: true } },
  trailer: { select: { empresaId: true } },
}

function buildMantenimientoData(body, owner) {
  const { tipo, descripcion, costo, proveedor, fecha, proximoMantenimiento } = body
  return {
    ...owner,
    tipo,
    descripcion,
    costo: Number(costo ?? 0),
    proveedor: proveedor || null,
    fecha: new Date(fecha),
    proximoMantenimiento: parseDate(proximoMantenimiento),
  }
}

export const createMantenimiento = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const camion = await prisma.camion.findFirst({ where: { id: req.params.id, empresaId } })
  if (!camion) return res.status(404).json({ error: 'Camión not found' })
  const m = await prisma.mantenimiento.create({ data: buildMantenimientoData(req.body, { camionId: req.params.id }) })
  res.status(201).json(m)
})

export const createTrailerMantenimiento = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const trailer = await prisma.trailer.findFirst({ where: { id: req.params.id, empresaId } })
  if (!trailer) return res.status(404).json({ error: 'Trailer not found' })
  const m = await prisma.mantenimiento.create({ data: buildMantenimientoData(req.body, { trailerId: req.params.id }) })
  res.status(201).json(m)
})

export const updateMantenimiento = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const m = await prisma.mantenimiento.findFirst({ where: { id: req.params.id }, include: OWNER_INCLUDE })
  if (!m || !belongsToEmpresa(m, empresaId)) return res.status(404).json({ error: 'Not found' })
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
  const m = await prisma.mantenimiento.findFirst({ where: { id: req.params.id }, include: OWNER_INCLUDE })
  if (!m || !belongsToEmpresa(m, empresaId)) return res.status(404).json({ error: 'Not found' })
  await prisma.mantenimiento.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})
