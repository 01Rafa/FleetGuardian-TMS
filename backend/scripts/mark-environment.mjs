import 'dotenv/config'
import prisma from '../src/lib/prisma.js'
import { APP_ENVS } from '../src/lib/env.js'
import { readMarker } from '../src/lib/environment.js'

const [name, ...flags] = process.argv.slice(2)
if (!APP_ENVS.includes(name)) {
  console.error(`Usage: node scripts/mark-environment.mjs <${APP_ENVS.join('|')}> [--force]`)
  process.exit(1)
}

try {
  const current = await readMarker(prisma)
  if (current && current !== name && !flags.includes('--force')) {
    console.error(`This database is already marked "${current}". Use --force only if you are sure.`)
    process.exit(1)
  }
  await prisma.$executeRaw`INSERT INTO "AppEnvironment" ("id", "name") VALUES (1, ${name}) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name"`
  console.log(`Database marked as ${name}`)
} catch (err) {
  if (/does not exist/i.test(String(err?.message))) {
    console.error('The AppEnvironment table does not exist. Apply backend/migrations/manual/006_environment_marker.sql first.')
    process.exit(1)
  }
  throw err
} finally {
  await prisma.$disconnect()
}
