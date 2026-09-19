import { extractRegistration } from '../services/registrationService.js'
import { catchAsync } from '../middleware/errorHandler.js'

export const extractRegistrationDoc = catchAsync(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })
  try {
    res.json(await extractRegistration(req.file.buffer, req.file.mimetype))
  } catch (err) {
    const busy = /ocupado|conectar|límite/.test(err.message ?? '')
    res.status(busy ? 503 : 422).json({ error: err.message })
  }
})
