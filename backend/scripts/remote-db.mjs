import 'dotenv/config'
import pg from 'pg'
import { APP_ENVS } from '../src/lib/env.js'

// Connects with DATABASE_URL (a value set in the terminal session wins over .env) and only continues if the
// database marker equals the --env given on the command line. Never prints the connection string.
export async function connectToEnvironment() {
  const i = process.argv.indexOf('--env')
  const envName = i >= 0 ? process.argv[i + 1] : undefined
  if (!APP_ENVS.includes(envName)) {
    console.error(`Usage: node <script> ... --env <${APP_ENVS.join('|')}>`)
    process.exit(1)
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const hasMarker = (await client.query(`SELECT to_regclass('"AppEnvironment"') AS t`)).rows[0].t !== null
  const marker = hasMarker ? ((await client.query('SELECT "name" FROM "AppEnvironment" WHERE "id" = 1')).rows[0]?.name ?? null) : null
  if (marker !== envName) {
    console.error(`Refusing: this database is marked "${marker ?? 'none'}" but you asked for "${envName}".`)
    await client.end()
    process.exit(1)
  }
  return { client, envName }
}
