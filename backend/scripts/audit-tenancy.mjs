import { connectToEnvironment } from './remote-db.mjs'

const { client, envName } = await connectToEnvironment()

const checks = [
  ['trips whose truck belongs to another company',
    `SELECT count(*)::int AS n FROM "Vuelta" v JOIN "Camion" c ON c."id" = v."camionId" WHERE c."empresaId" <> v."empresaId"`],
  ['trips whose main driver belongs to another company',
    `SELECT count(*)::int AS n FROM "Vuelta" v JOIN "Conductor" c ON c."id" = v."conductorPrincipalId" WHERE c."empresaId" <> v."empresaId"`],
  ['trips whose second driver belongs to another company',
    `SELECT count(*)::int AS n FROM "Vuelta" v JOIN "Conductor" c ON c."id" = v."conductorSecundarioId" WHERE c."empresaId" <> v."empresaId"`],
  ['legs whose broker belongs to another company',
    `SELECT count(*)::int AS n FROM "Tramo" t JOIN "Vuelta" v ON v."id" = t."vueltaId" JOIN "Broker" b ON b."id" = t."brokerId" WHERE b."empresaId" <> v."empresaId"`],
  ['expenses linked to a leg of another trip',
    `SELECT count(*)::int AS n FROM "Gasto" g JOIN "Tramo" t ON t."id" = g."tramoId" WHERE t."vueltaId" <> g."vueltaId"`],
  ['trip codes repeated inside one company (would block the new unique index)',
    `SELECT count(*)::int AS n FROM (SELECT 1 FROM "Vuelta" GROUP BY "empresaId", "codigo" HAVING count(*) > 1) x`],
  ['trip codes that do not match VLT-YYYY-N (kept as they are, not counted by the counter)',
    `SELECT count(*)::int AS n FROM "Vuelta" WHERE "codigo" !~ '^VLT-[0-9]{4}-[0-9]+$'`],
]

try {
  console.log(`Tenancy audit of the ${envName} database (counts only)`)
  let problems = 0
  for (const [label, sql] of checks) {
    const n = (await client.query(sql)).rows[0].n
    console.log(`${String(n).padStart(5)}  ${label}`)
    if (n > 0 && !label.startsWith('trip codes that do not match')) problems += n
  }
  console.log(problems === 0 ? '\nRESULT: clean, safe to apply migration 007.' : '\nRESULT: found data to review before continuing.')
} finally {
  await client.end()
}
