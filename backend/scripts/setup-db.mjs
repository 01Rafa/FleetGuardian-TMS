import 'dotenv/config'
import { execSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import pg from 'pg'
import { APP_ENVS } from '../src/lib/env.js'
import { checkSetupAllowed } from '../src/lib/environment.js'

const appEnv = process.env.APP_ENV
if (!APP_ENVS.includes(appEnv)) {
  console.error(`APP_ENV must be one of ${APP_ENVS.join(', ')}`)
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const exists = async table => (await client.query('SELECT to_regclass($1) AS t', [`"${table}"`])).rows[0].t !== null
const marker = (await exists('AppEnvironment')) ? ((await client.query('SELECT "name" FROM "AppEnvironment" WHERE "id" = 1')).rows[0]?.name ?? null) : null
const hasData = (await exists('Usuario')) && Number((await client.query('SELECT count(*) AS n FROM "Usuario"')).rows[0].n) > 0

const verdict = checkSetupAllowed({ appEnv, marker, hasData })
if (!verdict.ok) {
  console.error(verdict.message)
  await client.end()
  process.exit(1)
}

console.log(`[setup] building the ${appEnv} database`)
execSync('npx prisma db push --skip-generate', { stdio: 'inherit' })

const dir = new URL('../migrations/manual/', import.meta.url)
for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  await client.query(readFileSync(new URL(file, dir), 'utf8'))
  console.log(`[setup] applied ${file}`)
}
await client.query('INSERT INTO "AppEnvironment" ("id", "name") VALUES (1, $1) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name"', [appEnv])
await client.end()
console.log(`[setup] database marked as ${appEnv}`)

console.log('[setup] loading demo data')
execSync('node prisma/seed.js', { stdio: 'inherit' })
console.log('[setup] done. Demo login: admin@demo.com / demo1234 (development only)')
