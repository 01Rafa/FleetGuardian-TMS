import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { errorHandler } from './middleware/errorHandler.js'
import authRouter from './routes/auth.js'
import vueltasRouter from './routes/vueltas.js'
import tramosRouter from './routes/tramos.js'
import gastosRouter from './routes/gastos.js'
import camionesRouter from './routes/camiones.js'
import trailersRouter from './routes/trailers.js'
import conductoresRouter from './routes/conductores.js'
import dashboardRouter from './routes/dashboard.js'
import sugerenciasRouter from './routes/sugerencias.js'
import mantenimientosRouter from './routes/mantenimientos.js'
import piezasRouter from './routes/piezas.js'
import brokersRouter from './routes/brokers.js'
import notificacionesRouter from './routes/notificaciones.js'
import usuariosRouter from './routes/usuarios.js'
import routingRouter from './routes/routing.js'
import adminRouter from './routes/admin.js'
import rateconRouter from './routes/ratecon.js'
import registrationRouter from './routes/registration.js'
import cdlRouter from './routes/cdl.js'
import { jwtAuth } from './middleware/auth.js'
import { getAllowedOrigins, isOriginAllowed } from './lib/cors.js'

// The Express app without starting it: index.js adds the boot checks and listens, the integration tests
// serve it on a random port. Environment variables must be loaded before this file is imported.
export const app = express()

// Railway puts one proxy in front of the app. Without this every client shares the proxy IP,
// so the rate limiter would lock everybody out at once.
app.set('trust proxy', 1)
// The API is called from another origin (Vercel), so responses must stay readable cross-origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

const allowedOrigins = getAllowedOrigins()
console.log(`[cors] allowed origins: ${allowedOrigins.join(', ')}`)
if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS && !process.env.FRONTEND_URL) {
  console.warn('[cors] ALLOWED_ORIGINS / FRONTEND_URL are not set: the production frontend will be blocked')
}

// A rejected origin gets no CORS headers, so the browser refuses to let that page read the response.
app.use(cors({
  origin: (origin, callback) => callback(null, isOriginAllowed(origin, allowedOrigins)),
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
app.use('/api/trailers', trailersRouter)
app.use('/api/conductores', conductoresRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/sugerencias', sugerenciasRouter)
app.use('/api/mantenimientos', mantenimientosRouter)
app.use('/api/piezas', piezasRouter)
app.use('/api/brokers', brokersRouter)
app.use('/api/notificaciones', notificacionesRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/routing', routingRouter)
app.use('/api/admin', adminRouter)
app.use('/api/ratecon', rateconRouter)
app.use('/api/registration', registrationRouter)
app.use('/api/cdl', cdlRouter)

app.use(errorHandler)
