import { readFileSync } from 'node:fs'
import path from 'node:path'
import { connectToEnvironment } from './remote-db.mjs'

const file = process.argv[2]
const dir = path.resolve('migrations/manual')
const full = file ? path.resolve(file) : ''
if (!file || file.startsWith('--') || path.dirname(full) !== dir || !full.endsWith('.sql')) {
  console.error('Usage: node scripts/apply-sql.mjs migrations/manual/<file>.sql --env <production|development|staging>')
  process.exit(1)
}

const { client, envName } = await connectToEnvironment()
try {
  await client.query(readFileSync(full, 'utf8'))
  console.log(`Applied ${path.basename(full)} to the ${envName} database.`)
} finally {
  await client.end()
}
