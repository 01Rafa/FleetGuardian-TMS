import { extractRateConfirmation } from '../services/rateConService.js'
import { catchAsync } from '../middleware/errorHandler.js'
import { uploadMiddleware } from '../middleware/upload.js'

export { uploadMiddleware }

export const extractRateCon = catchAsync(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })
  try {
    const data = await extractRateConfirmation(req.file.buffer, req.file.mimetype)
    res.json(data)
  } catch (err) {
    const busy = /ocupado|conectar|límite/.test(err.message ?? '')
    res.status(busy ? 503 : 422).json({ error: err.message })
  }
})
