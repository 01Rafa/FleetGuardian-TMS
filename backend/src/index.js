import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middleware/errorHandler.js'
import authRouter from './routes/auth.js'
import vueltasRouter from './routes/vueltas.js'
import tramosRouter from './routes/tramos.js'
import gastosRouter from './routes/gastos.js'
import camionesRouter from './routes/camiones.js'
import conductoresRouter from './routes/conductores.js'
import dashboardRouter from './routes/dashboard.js'
import sugerenciasRouter from './routes/sugerencias.js'
import mantenimientosRouter from './routes/mantenimientos.js'
import piezasRouter from './routes/piezas.js'
import brokersRouter from './routes/brokers.js'
import notificacionesRouter from './routes/notificaciones.js'
import usuariosRouter from './routes/usuarios.js'
import { jwtAuth } from './middleware/auth.js'
import { startNotificacionesCron } from './jobs/notificaciones.job.js'

const app = express()

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5175',
  'https://fleetguardian-tms.vercel.app',
  /\.vercel\.app$/,
]

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.some((allowedOrigin) => (
      allowedOrigin instanceof RegExp ? allowedOrigin.test(origin) : allowedOrigin === origin
    ))) {
      return callback(null, true)
    }
    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRouter)
app.use('/api', jwtAuth)
// Block all non-GET requests for viewer role globally
app.use('/api', (req, res, next) => {
  if (req.user?.rol === 'viewer' && req.method !== 'GET') {
    return res.status(403).json({ error: 'Read-only access' })
  }
  next()
})
app.use('/api/vueltas', vueltasRouter)
app.use('/api/tramos', tramosRouter)
app.use('/api/gastos', gastosRouter)
app.use('/api/camiones', camionesRouter)
app.use('/api/conductores', conductoresRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/sugerencias', sugerenciasRouter)
app.use('/api/mantenimientos', mantenimientosRouter)
app.use('/api/piezas', piezasRouter)
app.use('/api/brokers', brokersRouter)
app.use('/api/notificaciones', notificacionesRouter)
app.use('/api/usuarios', usuariosRouter)

app.use(errorHandler)

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  startNotificacionesCron()
})
