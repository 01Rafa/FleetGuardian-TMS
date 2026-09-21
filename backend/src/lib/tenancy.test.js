import test from 'node:test'
import assert from 'node:assert/strict'
import { assertOwnedReferences } from './tenancy.js'

// company A owns everything prefixed a-, company B everything prefixed b-
function fakeDb() {
  const count = (ids, empresaId) => ids.filter(id => (empresaId === 'A' ? id.startsWith('a-') : id.startsWith('b-'))).length
  return {
    camion: { count: async ({ where }) => count([where.id], where.empresaId) },
    conductor: { count: async ({ where }) => count([where.id], where.empresaId) },
    broker: { count: async ({ where }) => count(where.id.in, where.empresaId) },
    tramo: {
      // tramo ids look like a-t1-v1: company a, tramo 1, trip v1
      count: async ({ where }) => where.id.in.filter(id => {
        const [company, , trip] = id.split('-')
        const okCompany = company === (where.vuelta.empresaId === 'A' ? 'a' : 'b')
        const okTrip = where.vuelta.id === undefined || `${company}-${trip}` === where.vuelta.id
        return okCompany && okTrip
      }).length,
    },
  }
}
const rejects = (promise, message) => assert.rejects(promise, err => err.status === 400 && err.message === message)

test('everything owned by the company passes', async () => {
  await assertOwnedReferences(fakeDb(), 'A', {
    camionId: 'a-c1', conductorPrincipalId: 'a-d1', conductorSecundarioId: 'a-d2',
    brokerIds: ['a-b1', 'a-b2'], tramoIds: ['a-t1-v1'],
  })
})

test('a truck of another company is rejected as camionId', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { camionId: 'b-c1' }), 'Invalid camionId')
})

test('a nonexistent truck gives the same answer as a foreign one', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { camionId: 'zzz' }), 'Invalid camionId')
})

test('each driver field is reported by name', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { conductorPrincipalId: 'b-d1' }), 'Invalid conductorPrincipalId')
  await rejects(assertOwnedReferences(fakeDb(), 'A', { conductorPrincipalId: 'a-d1', conductorSecundarioId: 'b-d2' }), 'Invalid conductorSecundarioId')
})

test('one foreign broker among several is rejected', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { brokerIds: ['a-b1', 'b-b1'] }), 'Invalid brokerId')
})

test('duplicates, null, undefined and empty strings are ignored', async () => {
  await assertOwnedReferences(fakeDb(), 'A', {
    conductorSecundarioId: '', brokerIds: ['a-b1', 'a-b1', null, undefined, ''], tramoIds: [null, undefined],
  })
  await assertOwnedReferences(fakeDb(), 'A', {})
})

test('a leg of another company is rejected as tramoId', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { tramoIds: ['b-t1-v1'] }), 'Invalid tramoId')
})

test('with vueltaId the leg must belong to that trip', async () => {
  await assertOwnedReferences(fakeDb(), 'A', { tramoIds: ['a-t1-v1'], vueltaId: 'a-v1' })
  await rejects(assertOwnedReferences(fakeDb(), 'A', { tramoIds: ['a-t1-v2'], vueltaId: 'a-v1' }), 'Invalid tramoId')
})

test('the first offending field is the one reported', async () => {
  await rejects(assertOwnedReferences(fakeDb(), 'A', { camionId: 'b-c1', brokerIds: ['b-b1'] }), 'Invalid camionId')
})
