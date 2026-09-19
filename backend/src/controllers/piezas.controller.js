import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'
import { belongsToEmpresa } from '../lib/ownership.js'

const PIEZA_EDITABLE = ['nombre', 'numeroParte', 'proveedor', 'costo', 'cantidad', 'fecha', 'notas']

// The owner (camionId / trailerId) is never editable through PUT.
export function pickPiezaFields(body) {
  const out = {}
  for (const key of PIEZA_EDITABLE) {
    if (body[key] !== undefined) out[key] = body[key]
  }
  return out
}

const OWNER_INCLUDE = {
  camion: { select: { empresaId: true } },
  trailer: { select: { empresaId: true } },
}

export const createPieza = catchAsync(async (req, res) => {
  const camion = await prisma.camion.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!camion) return res.status(404).json({ error: 'Camión not found' })
  const pieza = await prisma.pieza.create({ data: { ...req.body, camionId: req.params.id } })
  res.status(201).json(pieza)
})

export const createTrailerPieza = catchAsync(async (req, res) => {
  const trailer = await prisma.trailer.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!trailer) return res.status(404).json({ error: 'Trailer not found' })
  const pieza = await prisma.pieza.create({ data: { ...req.body, trailerId: req.params.id } })
  res.status(201).json(pieza)
})

export const updatePieza = catchAsync(async (req, res) => {
  const pieza = await prisma.pieza.findFirst({ where: { id: req.params.id }, include: OWNER_INCLUDE })
  if (!pieza || !belongsToEmpresa(pieza, req.user.empresaId)) return res.status(404).json({ error: 'Pieza not found' })
  const updated = await prisma.pieza.update({ where: { id: req.params.id }, data: pickPiezaFields(req.body) })
  res.json(updated)
})

export const deletePieza = catchAsync(async (req, res) => {
  const pieza = await prisma.pieza.findFirst({ where: { id: req.params.id }, include: OWNER_INCLUDE })
  if (!pieza || !belongsToEmpresa(pieza, req.user.empresaId)) return res.status(404).json({ error: 'Pieza not found' })
  await prisma.pieza.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})
