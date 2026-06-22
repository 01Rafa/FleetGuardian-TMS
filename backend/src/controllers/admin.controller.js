import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const getCacheStats = catchAsync(async (req, res) => {
  const [totalRoutesCache, totalGeocodeCache, hitAgg, topRoutes] = await Promise.all([
    prisma.routeCache.count(),
    prisma.geoCache.count(),
    prisma.routeCache.aggregate({ _sum: { hitCount: true } }),
    prisma.routeCache.findMany({
      orderBy: { hitCount: 'desc' },
      take: 10,
      select: { origenNormalized: true, destinoNormalized: true, hitCount: true },
    }),
  ])

  res.json({
    totalRoutesCache,
    totalGeocodeCache,
    totalCacheHits: hitAgg._sum.hitCount ?? 0,
    topRoutes: topRoutes.map(r => ({
      origen: r.origenNormalized,
      destino: r.destinoNormalized,
      hitCount: r.hitCount,
    })),
  })
})
