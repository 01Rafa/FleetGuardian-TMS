import 'dotenv/config'
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import prisma from '../../src/lib/prisma.js'
import { readMarker, checkDestructiveAllowed } from '../../src/lib/environment.js'
import { signAccess } from '../../src/lib/jwt.js'
import { app } from '../../src/app.js'

const stamp = Date.now()
const year = new Date().getFullYear()
const companies = {}
let server
let base

async function makeCompany(tag) {
  const empresa = await prisma.empresa.create({ data: { nombre: `Prueba integración ${tag} ${stamp}` } })
  const usuario = await prisma.usuario.create({
    data: { empresaId: empresa.id, nombre: `Admin ${tag}`, email: `int.${tag}.${stamp}@example.com`, password: 'x', rol: 'admin' },
  })
  const camion = await prisma.camion.create({ data: { empresaId: empresa.id, placa: `P-${tag}-${stamp}`, modelo: 'Test', tipo: 'dry_van' } })
  const conductor1 = await prisma.conductor.create({ data: { empresaId: empresa.id, nombre: `Conductor 1 ${tag}` } })
  const conductor2 = await prisma.conductor.create({ data: { empresaId: empresa.id, nombre: `Conductor 2 ${tag}` } })
  const broker = await prisma.broker.create({ data: { empresaId: empresa.id, nombre: `Broker ${tag} ${stamp}` } })
  // Seed trips use fixed codes so the per-company counter still starts at 001 for the first trip created through the API.
  const vuelta = await prisma.vuelta.create({
    data: {
      empresaId: empresa.id, camionId: camion.id, conductorPrincipalId: conductor1.id, codigo: `SEED-${tag}-1`,
      baseSalida: 'Miami, FL', fechaSalida: new Date(),
      tramos: { create: [{ orden: 1, origen: 'Miami, FL', destino: 'Atlanta, GA', fleteCobrado: 100, brokerId: broker.id }] },
    },
    include: { tramos: true },
  })
  const vuelta2 = await prisma.vuelta.create({
    data: { empresaId: empresa.id, camionId: camion.id, conductorPrincipalId: conductor1.id, codigo: `SEED-${tag}-2`, baseSalida: 'Miami, FL', fechaSalida: new Date() },
  })
  const gasto = await prisma.gasto.create({ data: { vueltaId: vuelta.id, categoria: 'combustible', monto: 10 } })
  const token = signAccess({ userId: usuario.id, empresaId: empresa.id, rol: 'admin' })
  return { empresa, usuario, camion, conductor1, conductor2, broker, vuelta, vuelta2, tramo: vuelta.tramos[0], gasto, token }
}

async function destroyCompany(c) {
  const where = { empresaId: c.empresa.id }
  await prisma.vuelta.deleteMany({ where })
  await prisma.camion.deleteMany({ where })
  await prisma.conductor.deleteMany({ where })
  await prisma.broker.deleteMany({ where })
  await prisma.contadorVuelta.deleteMany({ where })
  await prisma.empresa.delete({ where: { id: c.empresa.id } })
}

const call = (token, method, path, body) => fetch(base + path, {
  method,
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: body === undefined ? undefined : JSON.stringify(body),
})

const tripBody = (c, extra = {}) => ({
  camionId: c.camion.id, conductorPrincipalId: c.conductor1.id, baseSalida: 'Tampa, FL', fechaSalida: new Date().toISOString(), ...extra,
})

before(async () => {
  const verdict = checkDestructiveAllowed({ appEnv: process.env.APP_ENV, marker: await readMarker(prisma) })
  if (!verdict.ok) throw new Error(`Integration tests refuse to run: ${verdict.message}`)
  companies.A = await makeCompany('A')
  companies.B = await makeCompany('B')
  server = app.listen(0)
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server?.close()
  for (const c of Object.values(companies)) await destroyCompany(c)
  await prisma.$disconnect()
})

test('creating a trip with a foreign truck, driver or broker is rejected', async () => {
  const { A, B } = companies
  const cases = [
    [tripBody(A, { camionId: B.camion.id }), 'Invalid camionId'],
    [tripBody(A, { conductorPrincipalId: B.conductor1.id }), 'Invalid conductorPrincipalId'],
    [tripBody(A, { conductorSecundarioId: B.conductor2.id }), 'Invalid conductorSecundarioId'],
    [tripBody(A, { tramos: [{ orden: 1, origen: 'a', destino: 'b', brokerId: B.broker.id }] }), 'Invalid brokerId'],
    [tripBody(A, { gastos: [{ categoria: 'x', monto: 1, tramoId: B.tramo.id }] }), 'Invalid tramoId'],
  ]
  for (const [body, message] of cases) {
    const res = await call(A.token, 'POST', '/api/vueltas', body)
    assert.equal(res.status, 400, message)
    assert.equal((await res.json()).error, message)
  }
})

test('updating a trip with a foreign truck or driver is rejected, and its own ids still work', async () => {
  const { A, B } = companies
  const bad = await call(A.token, 'PUT', `/api/vueltas/${A.vuelta.id}`, { camionId: B.camion.id })
  assert.equal(bad.status, 400)
  const bad2 = await call(A.token, 'PUT', `/api/vueltas/${A.vuelta.id}`, { conductorSecundarioId: B.conductor2.id })
  assert.equal(bad2.status, 400)
  const ok = await call(A.token, 'PUT', `/api/vueltas/${A.vuelta.id}`, { conductorSecundarioId: A.conductor2.id })
  assert.equal(ok.status, 200)
})

test('merging trips with a foreign truck is rejected', async () => {
  const { A, B } = companies
  const res = await call(A.token, 'POST', '/api/vueltas/merge', {
    vueltaIds: [A.vuelta.id, A.vuelta2.id], camionId: B.camion.id, conductorPrincipalId: A.conductor1.id,
    baseSalida: 'Miami, FL', fechaSalida: new Date().toISOString(),
  })
  assert.equal(res.status, 400)
  assert.equal((await res.json()).error, 'Invalid camionId')
})

test('legs: a foreign broker is rejected on create and update', async () => {
  const { A, B } = companies
  const create = await call(A.token, 'POST', `/api/vueltas/${A.vuelta.id}/tramos`, { orden: 2, origen: 'a', destino: 'b', brokerId: B.broker.id })
  assert.equal(create.status, 400)
  const update = await call(A.token, 'PUT', `/api/tramos/${A.tramo.id}`, { brokerId: B.broker.id })
  assert.equal(update.status, 400)
  const ok = await call(A.token, 'PUT', `/api/tramos/${A.tramo.id}`, { brokerId: A.broker.id })
  assert.equal(ok.status, 200)
})

test('expenses: the leg must belong to the same trip', async () => {
  const { A, B } = companies
  const foreign = await call(A.token, 'POST', `/api/vueltas/${A.vuelta.id}/gastos`, { categoria: 'x', monto: 1, tramoId: B.tramo.id })
  assert.equal(foreign.status, 400)
  const otherTrip = await call(A.token, 'POST', `/api/vueltas/${A.vuelta2.id}/gastos`, { categoria: 'x', monto: 1, tramoId: A.tramo.id })
  assert.equal(otherTrip.status, 400)
  const ok = await call(A.token, 'POST', `/api/vueltas/${A.vuelta.id}/gastos`, { categoria: 'x', monto: 1, tramoId: A.tramo.id })
  assert.equal(ok.status, 201)
  // The update schema does not accept tramoId at all: the field is ignored and the expense keeps its leg.
  const update = await call(A.token, 'PUT', `/api/gastos/${A.gasto.id}`, { tramoId: B.tramo.id, monto: 11 })
  assert.equal(update.status, 200)
  const updated = await update.json()
  assert.equal(updated.monto, 11)
  assert.notEqual(updated.tramoId, B.tramo.id)
})

test('company A cannot read, change or delete records of company B', async () => {
  const { A, B } = companies
  for (const [method, path, body] of [
    ['GET', `/api/vueltas/${B.vuelta.id}`], ['PUT', `/api/vueltas/${B.vuelta.id}`, { notas: 'x' }], ['DELETE', `/api/vueltas/${B.vuelta.id}`],
    ['PATCH', `/api/vueltas/${B.vuelta.id}/estado`, { estado: 'en_curso' }],
    ['POST', `/api/vueltas/${B.vuelta.id}/tramos`, { orden: 5, origen: 'a', destino: 'b' }],
    ['POST', `/api/vueltas/${B.vuelta.id}/gastos`, { categoria: 'x', monto: 1 }],
    ['PUT', `/api/tramos/${B.tramo.id}`, { notas: 'x' }], ['DELETE', `/api/tramos/${B.tramo.id}`],
    ['PUT', `/api/gastos/${B.gasto.id}`, { monto: 2 }], ['DELETE', `/api/gastos/${B.gasto.id}`],
  ]) {
    const res = await call(A.token, method, path, body)
    assert.equal(res.status, 404, `${method} ${path}`)
  }
  const stillThere = await prisma.vuelta.count({ where: { id: B.vuelta.id } })
  assert.equal(stillThere, 1)
})

test('lists never include another company\'s data', async () => {
  const { A, B } = companies
  const trips = await (await call(A.token, 'GET', '/api/vueltas')).json()
  assert.ok(trips.length >= 2)
  assert.equal(trips.some(t => t.empresaId === B.empresa.id || t.id === B.vuelta.id), false)
  const trucks = await (await call(A.token, 'GET', '/api/camiones')).json()
  assert.equal(trucks.some(t => t.id === B.camion.id), false)
})

test('two companies both start their codes at 001', async () => {
  const { A, B } = companies
  const a = await (await call(A.token, 'POST', '/api/vueltas', tripBody(A))).json()
  const b = await (await call(B.token, 'POST', '/api/vueltas', tripBody(B))).json()
  assert.equal(a.codigo, `VLT-${year}-001`)
  assert.equal(b.codigo, `VLT-${year}-001`)
})

test('8 simultaneous creations give 8 distinct consecutive codes and a deleted code is not reused', async () => {
  // 8 at once is a heavy burst for one company and fits the connection pool of the test database.
  const C = await makeCompany('C')
  companies.C = C
  const results = await Promise.all(Array.from({ length: 8 }, () => call(C.token, 'POST', '/api/vueltas', tripBody(C))))
  assert.ok(results.every(r => r.status === 201), 'every creation succeeded')
  const codes = (await Promise.all(results.map(r => r.json()))).map(t => t.codigo)
  assert.equal(new Set(codes).size, 8)
  const numbers = codes.map(c => Number(c.split('-')[2])).sort((x, y) => x - y)
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8])

  const last = await prisma.vuelta.findFirst({ where: { empresaId: C.empresa.id, codigo: `VLT-${year}-008` } })
  const del = await call(C.token, 'DELETE', `/api/vueltas/${last.id}`)
  assert.equal(del.status, 200)
  const next = await (await call(C.token, 'POST', '/api/vueltas', tripBody(C))).json()
  assert.equal(next.codigo, `VLT-${year}-009`)
})

test('a code created behind the counter is skipped by the retry', async () => {
  const C = companies.C
  // Simulates the old backend creating VLT-<year>-010 while the counter stood at 009.
  await prisma.vuelta.create({
    data: { empresaId: C.empresa.id, camionId: C.camion.id, conductorPrincipalId: C.conductor1.id, codigo: `VLT-${year}-010`, baseSalida: 'x', fechaSalida: new Date() },
  })
  const res = await call(C.token, 'POST', '/api/vueltas', tripBody(C))
  assert.equal(res.status, 201)
  assert.equal((await res.json()).codigo, `VLT-${year}-011`)
})

test('cache-stats no longer lists the most requested routes', async () => {
  const res = await call(companies.A.token, 'GET', '/api/admin/cache-stats')
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal('topRoutes' in body, false)
  assert.equal(typeof body.totalRoutesCache, 'number')
})
