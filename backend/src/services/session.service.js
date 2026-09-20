import { randomUUID } from 'node:crypto'

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
// Two tabs (or React StrictMode) can present the same refresh cookie at nearly the same time.
// Inside this window a second use is a race, not a theft.
export const ROTATION_GRACE_MS = 10_000

const INVALID = { ok: false, reason: 'invalid' }

export function createSessionService({ db, now = () => new Date(), newId = randomUUID, ttlMs = SESSION_TTL_MS, graceMs = ROTATION_GRACE_MS }) {
  const create = async usuarioId => {
    const sid = newId()
    const expiresAt = new Date(now().getTime() + ttlMs)
    await db.createSession({ id: sid, usuarioId, expiresAt })
    return { sid, expiresAt }
  }

  return {
    async start(usuarioId) {
      await db.deleteExpired(usuarioId, now())
      return create(usuarioId)
    },

    async rotate(sid) {
      if (!sid) return INVALID
      const t = now()
      let session = await db.findSession(sid)
      if (!session || session.expiresAt <= t) return INVALID

      if (!session.rotatedAt) {
        if (await db.claimRotation(sid, t)) {
          const next = await create(session.usuarioId)
          return { ok: true, usuarioId: session.usuarioId, sid: next.sid }
        }
        session = await db.findSession(sid) // a concurrent request claimed it first
        if (!session?.rotatedAt) return INVALID
      }

      if (t.getTime() - session.rotatedAt.getTime() <= graceMs) {
        const next = await create(session.usuarioId)
        return { ok: true, usuarioId: session.usuarioId, sid: next.sid }
      }

      // A rotated token came back after the grace window: someone kept a copy. Cut every session of the user.
      await db.deleteAllForUser(session.usuarioId)
      return { ok: false, reason: 'reuse' }
    },

    end: sid => (sid ? db.deleteSession(sid) : Promise.resolve()),
    endAll: usuarioId => db.deleteAllForUser(usuarioId),
  }
}

export function createPrismaSessionDb(prisma) {
  return {
    createSession: ({ id, usuarioId, expiresAt }) => prisma.sesion.create({ data: { id, usuarioId, expiresAt } }),
    findSession: id => prisma.sesion.findUnique({ where: { id } }),
    // Only one caller can flip rotatedAt from null.
    claimRotation: async (id, at) => (await prisma.sesion.updateMany({ where: { id, rotatedAt: null }, data: { rotatedAt: at } })).count === 1,
    deleteSession: id => prisma.sesion.deleteMany({ where: { id } }),
    deleteAllForUser: usuarioId => prisma.sesion.deleteMany({ where: { usuarioId } }),
    deleteExpired: (usuarioId, at) => prisma.sesion.deleteMany({ where: { usuarioId, expiresAt: { lte: at } } }),
  }
}
