import prisma from '../lib/prisma.js'
import { recalcularVuelta } from '../lib/recalcularVuelta.js'
import { catchAsync } from '../middleware/errorHandler.js'
import { getRouteMiles } from '../services/routingService.js'

async function calcDistance(tramoId, origen, destino) {
  if (!origen || !destino) return
  try {
    const { distanceMillas, distanceKm } = await getRouteMiles(origen, destino)
    await prisma.tramo.update({
      where: { id: tramoId },
      data: { distanceMillas, distanceKm },
    })
  } catch {
    // Distance is best-effort — never block the tramo save
  }
}

export const createTramo = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const vuelta = await prisma.vuelta.findFirst({ where: { id: req.params.id, empresaId } })
  if (!vuelta) return res.status(404).json({ error: 'Vuelta not found' })
  const tramo = await prisma.tramo.create({ data: { ...req.body, vueltaId: req.params.id } })
  await recalcularVuelta(req.params.id)
  // Fire-and-forget: don't await, don't block response
  calcDistance(tramo.id, tramo.origen, tramo.destino)
  res.status(201).json(tramo)
})

export const updateTramo = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const tramo = await prisma.tramo.findFirst({
    where: { id: req.params.id },
    include: { vuelta: { select: { empresaId: true } } },
  })
  if (!tramo || tramo.vuelta.empresaId !== empresaId) return res.status(404).json({ error: 'Tramo not found' })
  const updated = await prisma.tramo.update({ where: { id: req.params.id }, data: req.body })
  await recalcularVuelta(tramo.vueltaId)
  // Recalculate distance if origin or destination changed
  const origenChanged = req.body.origen && req.body.origen !== tramo.origen
  const destinoChanged = req.body.destino && req.body.destino !== tramo.destino
  if (origenChanged || destinoChanged) {
    calcDistance(updated.id, updated.origen, updated.destino)
  }
  res.json(updated)
})

export const deleteTramo = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const tramo = await prisma.tramo.findFirst({
    where: { id: req.params.id },
    include: { vuelta: { select: { empresaId: true } } },
  })
  if (!tramo || tramo.vuelta.empresaId !== empresaId) return res.status(404).json({ error: 'Tramo not found' })
  await prisma.tramo.delete({ where: { id: req.params.id } })
  await recalcularVuelta(tramo.vueltaId)
  res.json({ ok: true })
})
