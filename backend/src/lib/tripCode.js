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

// Runs buildAndCreate(tx, codigo) in a transaction. A unique violation (a code created by an older backend
// between the migration and the deploy) retries with the next number, which also realigns the counter.
export async function withTripCode(prisma, empresaId, buildAndCreate, { maxAttempts = 5, anio = new Date().getFullYear() } = {}) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(async tx => buildAndCreate(tx, await nextCodigo(tx, empresaId, anio)))
    } catch (err) {
      if (err?.code !== 'P2002') throw err
      lastError = err
    }
  }
  throw lastError
}
