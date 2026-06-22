import { getRouteMiles } from '../services/routingService.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const getDistance = catchAsync(async (req, res) => {
  const { origen, destino } = req.query
  if (!origen?.trim() || !destino?.trim()) {
    return res.status(400).json({ error: 'origen and destino are required' })
  }
  const result = await getRouteMiles(origen.trim(), destino.trim())
  res.json(result)
})
