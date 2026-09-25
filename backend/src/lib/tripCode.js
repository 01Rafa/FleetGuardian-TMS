export const formatCodigo = (anio, n) => `VLT-${anio}-${String(n).padStart(3, '0')}`

// One atomic statement: it creates the counter row or increments it and returns the new value.
// Inside the caller's transaction, so a failed trip creation gives the number back.
export async function nextCodigo(tx, empresaId, anio) {
  const rows = await tx.$queryRaw`
    INSERT INTO "ContadorVuelta" ("empresaId", "anio", "ultimo") VALUES (${empresaId}, ${anio}, 1)
    ON CONFLICT ("empresaId", "anio") DO UPDATE SET "ultimo" = "ContadorVuelta"."ultimo" + 1
    RETURNING "ultimo"`
  return formatCodigo(anio, Number(rows[0].ultimo))
}

// Moves the counter up to the largest code that already exists for that company and year. It runs outside
// the failed transaction on purpose: the rollback of that transaction also rolls back its counter increment,
// so without this the retry would ask for the same number again.
async function realignCounter(prisma, empresaId, anio) {
  const pattern = `^VLT-${anio}-[0-9]+$`
  await prisma.$executeRaw`
    INSERT INTO "ContadorVuelta" ("empresaId", "anio", "ultimo")
    VALUES (${empresaId}, ${anio}, (SELECT COALESCE(MAX(CAST(substring("codigo" from 10) AS INTEGER)), 0)
                                    FROM "Vuelta" WHERE "empresaId" = ${empresaId} AND "codigo" ~ ${pattern}))
    ON CONFLICT ("empresaId", "anio") DO UPDATE SET "ultimo" = GREATEST(
      "ContadorVuelta"."ultimo",
      (SELECT COALESCE(MAX(CAST(substring("codigo" from 10) AS INTEGER)), 0)
       FROM "Vuelta" WHERE "empresaId" = ${empresaId} AND "codigo" ~ ${pattern}))`
}

// The counter row stays locked until the transaction commits, so trips of one company are created one after
// another. The generous limits let a burst queue up instead of failing (Prisma's defaults are 2 s and 5 s).
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 }

// Runs buildAndCreate(tx, codigo) in a transaction. A unique violation (a code created by an older backend
// between the migration and the deploy) realigns the counter with the existing codes and retries.
export async function withTripCode(prisma, empresaId, buildAndCreate, { maxAttempts = 5, anio = new Date().getFullYear() } = {}) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(async tx => buildAndCreate(tx, await nextCodigo(tx, empresaId, anio)), TRANSACTION_OPTIONS)
    } catch (err) {
      if (err?.code !== 'P2002') throw err
      lastError = err
      if (attempt < maxAttempts) await realignCounter(prisma, empresaId, anio)
    }
  }
  throw lastError
}
