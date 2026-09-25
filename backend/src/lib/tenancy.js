const invalid = field => Object.assign(new Error(`Invalid ${field}`), { status: 400 })

const unique = ids => [...new Set(ids.filter(Boolean))]

// Every id a write endpoint receives must belong to the caller's company. A foreign id and a nonexistent
// one get the same answer, so the response never says whether an id exists in another company.
export async function assertOwnedReferences(db, empresaId, refs = {}) {
  const { camionId, conductorPrincipalId, conductorSecundarioId, brokerIds = [], tramoIds = [], vueltaId } = refs

  if (camionId && !(await db.camion.count({ where: { id: camionId, empresaId } }))) throw invalid('camionId')

  for (const [field, id] of [['conductorPrincipalId', conductorPrincipalId], ['conductorSecundarioId', conductorSecundarioId]]) {
    if (id && !(await db.conductor.count({ where: { id, empresaId } }))) throw invalid(field)
  }

  const brokers = unique(brokerIds)
  if (brokers.length && (await db.broker.count({ where: { id: { in: brokers }, empresaId } })) !== brokers.length) throw invalid('brokerId')

  const tramos = unique(tramoIds)
  if (tramos.length) {
    const where = { id: { in: tramos }, vuelta: { empresaId, ...(vueltaId ? { id: vueltaId } : {}) } }
    if ((await db.tramo.count({ where })) !== tramos.length) throw invalid('tramoId')
  }
}
