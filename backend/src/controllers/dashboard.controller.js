import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const getStats = catchAsync(async (req, res) => {
  const { empresaId } = req.user
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const prevWeekStart = new Date(weekStart)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)

  const [vueltasActivas, semanaAgg, prevSemanaAgg, totalCamiones, camionesEnRuta] = await Promise.all([
    prisma.vuelta.count({ where: { empresaId, estado: { in: ['planificada', 'en_curso'] } } }),
    prisma.vuelta.aggregate({
      where: { empresaId, fechaSalida: { gte: weekStart } },
      _sum: { ingresoTotal: true, gastoTotal: true, rentabilidadNeta: true },
    }),
    prisma.vuelta.aggregate({
      where: { empresaId, fechaSalida: { gte: prevWeekStart, lt: weekStart } },
      _sum: { ingresoTotal: true, gastoTotal: true, rentabilidadNeta: true },
    }),
    prisma.camion.count({ where: { empresaId } }),
    prisma.camion.count({ where: { empresaId, estado: 'en_ruta' } }),
  ])

  res.json({
    vueltasActivas,
    ingresoSemana: semanaAgg._sum.ingresoTotal ?? 0,
    gastoSemana: semanaAgg._sum.gastoTotal ?? 0,
    rentabilidadSemana: semanaAgg._sum.rentabilidadNeta ?? 0,
    prevIngresoSemana: prevSemanaAgg._sum.ingresoTotal ?? 0,
    prevGastoSemana: prevSemanaAgg._sum.gastoTotal ?? 0,
    prevRentabilidadSemana: prevSemanaAgg._sum.rentabilidadNeta ?? 0,
    flotaUtilization: totalCamiones > 0 ? Math.round((camionesEnRuta / totalCamiones) * 100) : 0,
    totalCamiones,
    camionesEnRuta,
  })
})
