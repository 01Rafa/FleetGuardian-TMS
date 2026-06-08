import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

function topId(rows, key) {
  if (!rows.length) return null
  const counts = rows.reduce((acc, r) => {
    const v = r[key]
    if (v) acc[v] = (acc[v] ?? 0) + 1
    return acc
  }, {})
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

export const getSugerencias = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const { conductorId, camionId, conductorPrincipalId } = req.query

  // Suggest camion for a conductor (based on last 10 trips they drove)
  if (conductorId) {
    const rows = await prisma.vuelta.findMany({
      where: {
        empresaId,
        OR: [{ conductorPrincipalId: conductorId }, { conductorSecundarioId: conductorId }],
      },
      orderBy: { fechaSalida: 'desc' },
      take: 10,
      select: { camionId: true },
    })
    const id = topId(rows, 'camionId')
    const camion = id ? await prisma.camion.findUnique({ where: { id } }) : null
    return res.json({ camion: camion ?? null })
  }

  // Suggest principal conductor for a camion (based on last 10 trips)
  if (camionId) {
    const rows = await prisma.vuelta.findMany({
      where: { empresaId, camionId },
      orderBy: { fechaSalida: 'desc' },
      take: 10,
      select: { conductorPrincipalId: true },
    })
    const id = topId(rows, 'conductorPrincipalId')
    const conductor = id ? await prisma.conductor.findUnique({ where: { id } }) : null
    return res.json({ conductor: conductor ?? null })
  }

  // Suggest secondary conductor when principal is known
  if (conductorPrincipalId) {
    const rows = await prisma.vuelta.findMany({
      where: { empresaId, conductorPrincipalId, conductorSecundarioId: { not: null } },
      orderBy: { fechaSalida: 'desc' },
      take: 10,
      select: { conductorSecundarioId: true },
    })
    const id = topId(rows, 'conductorSecundarioId')
    const conductor = id ? await prisma.conductor.findUnique({ where: { id } }) : null
    return res.json({ conductor: conductor ?? null })
  }

  res.json({})
})
