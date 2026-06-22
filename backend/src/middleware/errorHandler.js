export function catchAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

const PRISMA_CODES = new Set(['P1', 'P2', 'P3', 'P4', 'P5', 'P6'])
function isPrismaError(err) {
  return err.code && typeof err.code === 'string' && PRISMA_CODES.has(err.code.slice(0, 2))
}

export function errorHandler(err, req, res, next) {
  if (isPrismaError(err)) {
    console.error(err)
    const status = err.code === 'P2002' ? 409 : err.code === 'P2025' ? 404 : 500
    const message = err.code === 'P2002' ? 'A record with that value already exists' :
      err.code === 'P2025' ? 'Record not found' : 'Database error'
    return res.status(status).json({ error: message })
  }
  const status = err.status ?? 500
  const message = err.message ?? 'Internal server error'
  if (status === 500) console.error(err)
  res.status(status).json({ error: message })
}
