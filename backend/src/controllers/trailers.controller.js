import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const TRAILER_DATE_FIELDS = [
  'fechaCompra', 'dotInspectionLastDate', 'stateInspectionLastDate', 'brakeInspectionLastDate',
  'registrationExpiry', 'cargoInsuranceExpiry', 'epaRefrigerantExpiry',
]

export function parseTrailerDateFields(body) {
  const data = { ...body }
  for (const field of TRAILER_DATE_FIELDS) {
    if (field in data) {
      data[field] = data[field] ? new Date(data[field]) : null
    }
  }
  return data
}

export const listTrailers = catchAsync(async (req, res) => {
  const trailers = await prisma.trailer.findMany({ where: { empresaId: req.user.empresaId }, orderBy: { placa: 'asc' } })
  res.json(trailers)
})

export const getTrailer = catchAsync(async (req, res) => {
  const trailer = await prisma.trailer.findFirst({
    where: { id: req.params.id, empresaId: req.user.empresaId },
    include: {
      mantenimientos: { orderBy: { fecha: 'desc' } },
      piezas: { orderBy: { fecha: 'desc' } },
    },
  })
  if (!trailer) return res.status(404).json({ error: 'Trailer not found' })
  res.json(trailer)
})

export const createTrailer = catchAsync(async (req, res) => {
  const trailer = await prisma.trailer.create({ data: { ...parseTrailerDateFields(req.body), empresaId: req.user.empresaId } })
  res.status(201).json(trailer)
})

export const updateTrailer = catchAsync(async (req, res) => {
  const trailer = await prisma.trailer.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!trailer) return res.status(404).json({ error: 'Trailer not found' })
  const updated = await prisma.trailer.update({ where: { id: req.params.id }, data: parseTrailerDateFields(req.body) })
  res.json(updated)
})

// Deleting a trailer also deletes its own maintenance and parts (onDelete: Cascade).
export const deleteTrailer = catchAsync(async (req, res) => {
  const trailer = await prisma.trailer.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!trailer) return res.status(404).json({ error: 'Trailer not found' })
  await prisma.trailer.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})
