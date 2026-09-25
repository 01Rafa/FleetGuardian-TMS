import { extractCdl } from '../services/cdlService.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const extractCdlDoc = catchAsync(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })
  try {
    res.json(await extractCdl(req.file.buffer, req.file.mimetype))
  } catch (err) {
    const busy = /ocupado|conectar|límite/.test(err.message ?? '')
    res.status(busy ? 503 : 422).json({ error: err.message })
  }
})
