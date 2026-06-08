import prisma from './prisma.js'

export async function recalcularVuelta(vueltaId, tx = prisma) {
  const [tramoAgg, gastoAgg] = await Promise.all([
    tx.tramo.aggregate({ where: { vueltaId }, _sum: { fleteCobrado: true } }),
    tx.gasto.aggregate({ where: { vueltaId }, _sum: { monto: true } }),
  ])
  const ingresoTotal = tramoAgg._sum.fleteCobrado ?? 0
  const gastoTotal = gastoAgg._sum.monto ?? 0
  await tx.vuelta.update({
    where: { id: vueltaId },
    data: { ingresoTotal, gastoTotal, rentabilidadNeta: ingresoTotal - gastoTotal },
  })
}
