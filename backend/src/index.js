import 'dotenv/config'
import { app } from './app.js'
import { startNotificacionesCron } from './jobs/notificaciones.job.js'
import { runSeed } from './seeds/runSeed.js'
import { validateEnv } from './lib/env.js'
import prisma from './lib/prisma.js'
import { assertDatabaseEnvironment } from './lib/environment.js'

validateEnv()

// Stop before the seed or the cron touch anything if this database is not the environment we think it is.
try {
  await assertDatabaseEnvironment(prisma, process.env.APP_ENV)
  console.log(`[env] APP_ENV=${process.env.APP_ENV}, the database marker matches`)
} catch (err) {
  console.error(`[env] ${err.message}`)
  process.exit(1)
}

const PORT = process.env.PORT ?? 3000
runSeed().catch(err => console.error('[seed] Failed to seed cities:', err))
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
  startNotificacionesCron()
})
