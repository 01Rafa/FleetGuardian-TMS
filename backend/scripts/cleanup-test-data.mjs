import { connectToEnvironment } from './remote-db.mjs'

const { client, envName } = await connectToEnvironment()
const TEST_COMPANY = 'Prueba Dia4 (borrar)'

try {
  // Only companies with this exact name whose users all look like test accounts.
  const found = await client.query(
    `SELECT e."id" FROM "Empresa" e
     WHERE e."nombre" = $1
       AND NOT EXISTS (SELECT 1 FROM "Usuario" u WHERE u."empresaId" = e."id" AND u."email" NOT LIKE 'prueba.dia4.%@example.com')`,
    [TEST_COMPANY],
  )
  const ids = found.rows.map(r => r.id)
  console.log(`Test companies found in the ${envName} database: ${ids.length}`)
  if (ids.length) {
    await client.query('BEGIN')
    for (const table of ['Vuelta', 'Camion', 'Conductor', 'Trailer', 'Broker', 'Notificacion', 'ContadorVuelta']) {
      const r = await client.query(`DELETE FROM "${table}" WHERE "empresaId" = ANY($1)`, [ids])
      console.log(`  deleted ${r.rowCount} from ${table}`)
    }
    const r = await client.query('DELETE FROM "Empresa" WHERE "id" = ANY($1)', [ids])
    console.log(`  deleted ${r.rowCount} companies (their users and sessions go with them)`)
    await client.query('COMMIT')
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {})
  throw err
} finally {
  await client.end()
}
