import prisma from '../lib/prisma.js'
import { catchAsync } from '../middleware/errorHandler.js'

// Aggregate counters only. The most requested routes are not listed: the cache is shared by every
// company, so that list would show one company what the others are shipping.
export const getCacheStats = catchAsync(async (req, res) => {
  const [totalRoutesCache, totalGeocodeCache, hitAgg] = await Promise.all([
    prisma.routeCache.count(),
    prisma.geoCache.count(),
    prisma.routeCache.aggregate({ _sum: { hitCount: true } }),
  ])

  res.json({
    totalRoutesCache,
    totalGeocodeCache,
    totalCacheHits: hitAgg._sum.hitCount ?? 0,
  })
})
