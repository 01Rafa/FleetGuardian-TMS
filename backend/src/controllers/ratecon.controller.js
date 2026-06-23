import multer from 'multer'
import { extractRateConfirmation } from '../services/rateConService.js'
import { catchAsync } from '../middleware/errorHandler.js'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true)
    cb(Object.assign(new Error('Tipo de archivo no permitido'), { status: 422 }))
  },
})

// Wrap multer for Express 5 promise-based error handling
export const uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return next(err)
    next()
  })
}

export const extractRateCon = catchAsync(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })
  try {
    const data = await extractRateConfirmation(req.file.buffer, req.file.mimetype)
    res.json(data)
  } catch (err) {
    res.status(422).json({ error: err.message })
  }
})
