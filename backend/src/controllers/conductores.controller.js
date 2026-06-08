import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

const DATE_FIELDS = [
  'cdlExpiry', 'medicalExamExpiry', 'drugTestLastDate', 'alcoholTestLastDate',
  'mvrLastDate', 'hazmatExpiry', 'twicExpiry', 'annualReviewDate', 'safetyTrainingDate',
]

function parseDateFields(body) {
  const data = { ...body }
  for (const field of DATE_FIELDS) {
    if (field in data) {
      data[field] = data[field] ? new Date(data[field]) : null
    }
  }
  return data
}

export const listConductores = catchAsync(async (req, res) => {
  const conductores = await prisma.conductor.findMany({ where: { empresaId: req.user.empresaId }, orderBy: { nombre: 'asc' } })
  res.json(conductores)
})

export const getConductor = catchAsync(async (req, res) => {
  const conductor = await prisma.conductor.findFirst({
    where: { id: req.params.id, empresaId: req.user.empresaId },
    include: {
      vueltasPrincipal: {
        orderBy: { fechaSalida: 'desc' },
        take: 10,
        include: { camion: { select: { placa: true, modelo: true } } },
      },
    },
  })
  if (!conductor) return res.status(404).json({ error: 'Conductor not found' })
  res.json(conductor)
})

export const createConductor = catchAsync(async (req, res) => {
  const conductor = await prisma.conductor.create({ data: { ...parseDateFields(req.body), empresaId: req.user.empresaId } })
  res.status(201).json(conductor)
})

export const updateConductor = catchAsync(async (req, res) => {
  const conductor = await prisma.conductor.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!conductor) return res.status(404).json({ error: 'Conductor not found' })
  const updated = await prisma.conductor.update({ where: { id: req.params.id }, data: parseDateFields(req.body) })
  res.json(updated)
})

export const deleteConductor = catchAsync(async (req, res) => {
  const conductor = await prisma.conductor.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!conductor) return res.status(404).json({ error: 'Conductor not found' })
  try {
    await prisma.conductor.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    if (e.code === 'P2003' || e.code === 'P2014') {
      return res.status(409).json({ error: 'No se puede eliminar un conductor con vueltas asociadas' })
    }
    throw e
  }
})
