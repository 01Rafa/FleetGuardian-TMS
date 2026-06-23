import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

const TRUCK_DATE_FIELDS = [
  'fechaCompra', 'vencimientoRegistracion', 'vencimientoSeguro', 'vencimientoInspeccion',
  'dotInspectionLastDate', 'stateInspectionLastDate', 'brakeInspectionLastDate', 'ucrLastDate',
  'dotBiennualUpdate', 'registrationExpiry', 'iftaExpiry', 'irpExpiry',
  'liabilityInsuranceExpiry', 'cargoInsuranceExpiry', 'bobtailInsuranceExpiry', 'epaRefrigerantExpiry',
]

function parseTruckDateFields(body) {
  const data = { ...body }
  for (const field of TRUCK_DATE_FIELDS) {
    if (field in data) {
      data[field] = data[field] ? new Date(data[field]) : null
    }
  }
  return data
}

export const listCamiones = catchAsync(async (req, res) => {
  const camiones = await prisma.camion.findMany({ where: { empresaId: req.user.empresaId }, orderBy: { placa: 'asc' } })
  res.json(camiones)
})

export const getCamion = catchAsync(async (req, res) => {
  const camion = await prisma.camion.findFirst({
    where: { id: req.params.id, empresaId: req.user.empresaId },
    include: {
      mantenimientos: { orderBy: { fecha: 'desc' } },
      piezas: { orderBy: { fecha: 'desc' } },
    },
  })
  if (!camion) return res.status(404).json({ error: 'Camión not found' })
  const kmAgg = await prisma.tramo.aggregate({
    where: { vuelta: { camionId: req.params.id, empresaId: req.user.empresaId } },
    _sum: { kmRecorridos: true },
  })
  res.json({ ...camion, kmTotales: kmAgg._sum.kmRecorridos ?? 0 })
})

export const createCamion = catchAsync(async (req, res) => {
  const camion = await prisma.camion.create({ data: { ...parseTruckDateFields(req.body), empresaId: req.user.empresaId } })
  res.status(201).json(camion)
})

export const updateCamion = catchAsync(async (req, res) => {
  const camion = await prisma.camion.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!camion) return res.status(404).json({ error: 'Camion not found' })
  const updated = await prisma.camion.update({ where: { id: req.params.id }, data: parseTruckDateFields(req.body) })
  res.json(updated)
})

export const deleteCamion = catchAsync(async (req, res) => {
  const camion = await prisma.camion.findFirst({ where: { id: req.params.id, empresaId: req.user.empresaId } })
  if (!camion) return res.status(404).json({ error: 'Camion not found' })
  try {
    await prisma.camion.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (e) {
    if (e.code === 'P2003' || e.code === 'P2014') {
      return res.status(409).json({ error: 'No se puede eliminar un camión con vueltas asociadas' })
    }
    throw e
  }
})

export const getLastLocation = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({
    where: {
      camionId: req.params.id,
      empresaId,
      tramos: { some: {} },
    },
    orderBy: { fechaSalida: 'desc' },
    include: {
      tramos: { orderBy: { orden: 'desc' }, take: 1 },
    },
  })

  if (!vuelta || !vuelta.tramos.length) {
    return res.json({ lastLocation: null, lastTripDate: null })
  }

  res.json({
    lastLocation: vuelta.tramos[0].destino,
    lastTripDate: vuelta.fechaSalida.toISOString(),
  })
})
