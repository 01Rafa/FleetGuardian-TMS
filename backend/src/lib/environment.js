// Each database stores which environment it is ("AppEnvironment", one row). The process says which one it
// wants to be with APP_ENV. Comparing the two is more reliable than matching hostnames.

export function checkEnvironmentMarker({ appEnv, marker }) {
  if (!marker) {
    return { ok: false, message: `This database has no environment marker. If it really is the ${appEnv} database, run: node scripts/mark-environment.mjs ${appEnv}` }
  }
  if (marker !== appEnv) {
    return { ok: false, message: `Refusing to run: APP_ENV is "${appEnv}" but this database is marked "${marker}". Point DATABASE_URL at the ${appEnv} database.` }
  }
  return { ok: true }
}

// For scripts that delete data (prisma/seed.js).
export function checkDestructiveAllowed({ appEnv, marker }) {
  if (appEnv === 'production') {
    return { ok: false, message: 'Refusing to run: this script deletes data and never runs with APP_ENV=production.' }
  }
  // No advice to "mark it" here: marking a real production database as development would unlock this script.
  if (!marker) {
    return { ok: false, message: 'Refusing to run: this database has no environment marker, so it could be production. Build development databases with scripts/setup-db.mjs.' }
  }
  return checkEnvironmentMarker({ appEnv, marker })
}

// For scripts/mark-environment.mjs. Marking a database that already holds data as non-production is how a
// production database would end up unprotected, so it needs an explicit --force.
export function checkMarkAllowed({ name, current, hasData, force }) {
  if (current && current !== name && !force) {
    return { ok: false, message: `This database is already marked "${current}". Use --force only if you are sure.` }
  }
  if (!current && hasData && name !== 'production' && !force) {
    return { ok: false, message: `This database already has data. Marking it "${name}" could hide that it is production. Use --force only if you are sure.` }
  }
  return { ok: true }
}

// For scripts/setup-db.mjs, which builds a database from scratch. A fresh database has no marker yet.
export function checkSetupAllowed({ appEnv, marker, hasData }) {
  if (appEnv === 'production') {
    return { ok: false, message: 'Refusing to run: setup-db never runs with APP_ENV=production.' }
  }
  if (marker && marker !== appEnv) {
    return { ok: false, message: `Refusing to run: this database is marked "${marker}" but APP_ENV is "${appEnv}".` }
  }
  if (!marker && hasData) {
    return { ok: false, message: 'Refusing to run: this database has data but no environment marker, so it could be production.' }
  }
  return { ok: true }
}

// null when the marker table or row does not exist yet; any other database error is rethrown.
export async function readMarker(prisma) {
  try {
    const rows = await prisma.$queryRaw`SELECT "name" FROM "AppEnvironment" WHERE "id" = 1`
    return rows[0]?.name ?? null
  } catch (err) {
    if (/does not exist/i.test(String(err?.message))) return null
    throw err
  }
}

export async function assertDatabaseEnvironment(prisma, appEnv) {
  const result = checkEnvironmentMarker({ appEnv, marker: await readMarker(prisma) })
  if (!result.ok) throw new Error(result.message)
}
