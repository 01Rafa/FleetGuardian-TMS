import prisma from '../lib/prisma.js'
import { recalcularVuelta } from '../lib/recalcularVuelta.js'
import { catchAsync } from '../middleware/errorHandler.js'
import { assertOwnedReferences } from '../lib/tenancy.js'
import { withTripCode } from '../lib/tripCode.js'

export function prepareCreateVueltaData({ body, empresaId, codigo }) {
  const { tramos = [], gastos = [], ...vueltaData } = body
  const ingresoTotal = tramos.reduce((sum, tramo) => sum + Number(tramo.fleteCobrado ?? 0), 0)
  const gastoTotal = gastos.reduce((sum, gasto) => sum + Number(gasto.monto ?? 0), 0)

  return {
    ...vueltaData,
    empresaId,
    codigo,
    ingresoTotal,
    gastoTotal,
    rentabilidadNeta: ingresoTotal - gastoTotal,
    ...(tramos.length ? { tramos: { create: tramos } } : {}),
    ...(gastos.length ? { gastos: { create: gastos } } : {}),
  }
}

export const listVueltas = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const { estado, camionId, fechaDesde, fechaHasta, brokerId } = req.query
  const where = { empresaId }
  if (estado) where.estado = estado
  if (camionId) where.camionId = camionId
  if (brokerId) where.tramos = { some: { brokerId } }
  if (fechaDesde || fechaHasta) {
    where.fechaSalida = {}
    if (fechaDesde) {
      const d = new Date(fechaDesde)
      if (!isNaN(d.getTime())) where.fechaSalida.gte = d
    }
    if (fechaHasta) {
      const d = new Date(fechaHasta)
      if (!isNaN(d.getTime())) where.fechaSalida.lte = d
    }
  }
  const vueltas = await prisma.vuelta.findMany({
    where,
    include: {
      camion: true,
      conductorPrincipal: true,
      conductorSecundario: true,
      tramos: { orderBy: { orden: 'asc' }, select: { origen: true, destino: true, numeroCarga: true, distanceMillas: true } },
    },
    orderBy: { creadoEn: 'desc' },
  })
  const vueltasWithCpm = vueltas.map(v => {
    const allHaveMiles = v.tramos.length > 0 && v.tramos.every(t => t.distanceMillas != null)
    const totalMillas = allHaveMiles ? v.tramos.reduce((s, t) => s + t.distanceMillas, 0) : null
    const cpm = totalMillas && totalMillas > 0 ? v.gastoTotal / totalMillas : null
    return { ...v, totalMillas, cpm }
  })
  res.json(vueltasWithCpm)
})

export const createVuelta = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const { camionId, conductorPrincipalId, conductorSecundarioId, tramos = [], gastos = [] } = req.body
  await assertOwnedReferences(prisma, empresaId, {
    camionId, conductorPrincipalId, conductorSecundarioId,
    brokerIds: tramos.map(t => t.brokerId),
    tramoIds: gastos.map(g => g.tramoId),
  })
  const vuelta = await withTripCode(prisma, empresaId, (tx, codigo) => tx.vuelta.create({
    data: prepareCreateVueltaData({ body: req.body, empresaId, codigo }),
    include: {
      camion: true,
      conductorPrincipal: true,
      conductorSecundario: true,
      tramos: { orderBy: { orden: 'asc' }, select: { destino: true, numeroCarga: true } },
    },
  }))
  res.status(201).json(vuelta)
})

export const getVuelta = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({
    where: { id: req.params.id, empresaId },
    include: {
      camion: true,
      conductorPrincipal: true,
      conductorSecundario: true,
      tramos: { orderBy: { orden: 'asc' }, include: { gastos: true, broker: true } },
      gastos: { orderBy: { fecha: 'asc' } },
    },
  })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  const kmTotales = vuelta.tramos.reduce((s, t) => s + (t.kmRecorridos ?? 0), 0)
  const allHaveMiles = vuelta.tramos.length > 0 && vuelta.tramos.every(t => t.distanceMillas != null)
  const totalMillas = allHaveMiles
    ? vuelta.tramos.reduce((s, t) => s + t.distanceMillas, 0)
    : null
  const cpm = totalMillas && totalMillas > 0 ? vuelta.gastoTotal / totalMillas : null
  res.json({ ...vuelta, kmTotales, totalMillas, cpm })
})

export const updateVuelta = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.id, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  await assertOwnedReferences(prisma, empresaId, {
    camionId: req.body.camionId,
    conductorPrincipalId: req.body.conductorPrincipalId,
    conductorSecundarioId: req.body.conductorSecundarioId,
  })
  const data = { ...req.body }
  if (data.conductorSecundarioId === '') data.conductorSecundarioId = null
  await prisma.vuelta.update({ where: { id: req.params.id }, data })
  await recalcularVuelta(req.params.id)
  const updated = await prisma.vuelta.findUnique({ where: { id: req.params.id } })
  res.json(updated)
})

export const deleteVuelta = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.id, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  await prisma.vuelta.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

export const changeEstado = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.id, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  const VALID_ESTADOS = ['planificada', 'en_curso', 'completada', 'facturada']
  if (!VALID_ESTADOS.includes(req.body.estado)) {
    return res.status(400).json({ error: `Estado must be one of: ${VALID_ESTADOS.join(', ')}` })
  }
  const updated = await prisma.vuelta.update({
    where: { id: req.params.id },
    data: { estado: req.body.estado },
  })
  await recalcularVuelta(req.params.id)
  res.json(updated)
})

export const mergeVueltas = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const { vueltaIds, camionId, conductorPrincipalId, conductorSecundarioId, baseSalida, fechaSalida } = req.body

  if (!Array.isArray(vueltaIds) || vueltaIds.length < 2) {
    return res.status(400).json({ error: 'Se requieren al menos 2 vueltas para agrupar' })
  }

  const sources = await prisma.vuelta.findMany({
    where: { id: { in: vueltaIds }, empresaId },
    include: { tramos: { orderBy: { orden: 'asc' } }, gastos: true },
  })

  if (sources.length !== vueltaIds.length) {
    return res.status(404).json({ error: 'Una o más vueltas no encontradas' })
  }

  await assertOwnedReferences(prisma, empresaId, { camionId, conductorPrincipalId, conductorSecundarioId })

  const newVuelta = await withTripCode(prisma, empresaId, async (tx, codigo) => {
    const vuelta = await tx.vuelta.create({
      data: {
        empresaId, camionId, conductorPrincipalId, baseSalida, fechaSalida: new Date(fechaSalida), codigo,
        ...(conductorSecundarioId ? { conductorSecundarioId } : {}),
      },
    })

    let orden = 1
    for (const vid of vueltaIds) {
      const src = sources.find(v => v.id === vid)
      for (const tramo of src.tramos) {
        await tx.tramo.update({ where: { id: tramo.id }, data: { vueltaId: vuelta.id, orden: orden++ } })
      }
    }

    for (const src of sources) {
      for (const gasto of src.gastos) {
        await tx.gasto.update({ where: { id: gasto.id }, data: { vueltaId: vuelta.id } })
      }
    }

    await tx.vuelta.deleteMany({ where: { id: { in: vueltaIds } } })

    return vuelta
  })

  await recalcularVuelta(newVuelta.id)

  const final = await prisma.vuelta.findUnique({
    where: { id: newVuelta.id },
    include: { camion: true, conductorPrincipal: true, conductorSecundario: true },
  })
  res.status(201).json(final)
})
