import cron from 'node-cron'
import prisma from '../lib/prisma.js'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000
const TWO_YEAR_MS = 2 * YEAR_MS
const THRESHOLD_DAYS = 30

const DRIVER_FIELDS = [
  { key: 'cdlExpiry', label: 'CDL', type: 'expiry' },
  { key: 'medicalExamExpiry', label: 'DOT Physical', type: 'expiry' },
  { key: 'hazmatExpiry', label: 'HazMat Cert', type: 'expiry' },
  { key: 'twicExpiry', label: 'TWIC Card', type: 'expiry' },
  { key: 'drugTestLastDate', label: 'Drug Test', type: 'interval', intervalMs: YEAR_MS },
  { key: 'alcoholTestLastDate', label: 'Alcohol Test', type: 'interval', intervalMs: YEAR_MS },
  { key: 'mvrLastDate', label: 'MVR Check', type: 'interval', intervalMs: YEAR_MS },
  { key: 'annualReviewDate', label: 'Annual Review', type: 'interval', intervalMs: YEAR_MS },
  { key: 'safetyTrainingDate', label: 'Safety Training', type: 'interval', intervalMs: YEAR_MS },
]

const TRUCK_FIELDS = [
  { key: 'dotInspectionLastDate', label: 'DOT Annual Inspection', type: 'interval', intervalMs: YEAR_MS },
  { key: 'stateInspectionLastDate', label: 'State Inspection', type: 'interval', intervalMs: YEAR_MS },
  { key: 'brakeInspectionLastDate', label: 'Brake Inspection', type: 'interval', intervalMs: YEAR_MS },
  { key: 'ucrLastDate', label: 'UCR Registration', type: 'interval', intervalMs: YEAR_MS },
  { key: 'dotBiennualUpdate', label: 'DOT Biennial Update', type: 'interval', intervalMs: TWO_YEAR_MS },
  { key: 'registrationExpiry', label: 'Registration', type: 'expiry' },
  { key: 'iftaExpiry', label: 'IFTA License', type: 'expiry' },
  { key: 'irpExpiry', label: 'IRP Plate', type: 'expiry' },
  { key: 'liabilityInsuranceExpiry', label: 'Liability Insurance', type: 'expiry' },
  { key: 'cargoInsuranceExpiry', label: 'Cargo Insurance', type: 'expiry' },
  { key: 'bobtailInsuranceExpiry', label: 'Bobtail Insurance', type: 'expiry' },
  { key: 'epaRefrigerantExpiry', label: 'EPA Refrigerant Cert', type: 'expiry', reeferOnly: true },
]

function computeNextDue(field, value) {
  if (!value) return null
  const date = new Date(value)
  if (isNaN(date.getTime())) return null
  return field.type === 'expiry' ? date : new Date(date.getTime() + field.intervalMs)
}

function buildTitle(label, daysLeft) {
  if (daysLeft < 0) return `${label} overdue`
  if (daysLeft === 0) return `${label} due today`
  return `${label} expiring soon`
}

function pluralDays(n) {
  return `${n} day${n === 1 ? '' : 's'}`
}

function buildDriverMessage(nombre, field, daysLeft) {
  const labelLower = field.label.toLowerCase()
  if (daysLeft < 0) return `${nombre}'s ${labelLower} is ${pluralDays(Math.abs(daysLeft))} overdue`
  if (daysLeft === 0) return `${nombre}'s ${labelLower} is due today`
  const verb = field.type === 'expiry' ? 'expires' : 'is due'
  return `${nombre}'s ${labelLower} ${verb} in ${pluralDays(daysLeft)}`
}

function buildTruckMessage(placa, field, daysLeft) {
  const labelLower = field.label.toLowerCase()
  if (daysLeft < 0) return `Truck ${placa} ${labelLower} is ${pluralDays(Math.abs(daysLeft))} overdue`
  if (daysLeft === 0) return `Truck ${placa} ${labelLower} is due today`
  const verb = field.type === 'expiry' ? 'expires' : 'is due'
  return `Truck ${placa} ${labelLower} ${verb} in ${pluralDays(daysLeft)}`
}

async function checkEntity(empresaId, entity, fields, tipo, buildMsg) {
  const now = Date.now()
  for (const field of fields) {
    if (field.reeferOnly && entity.tipo !== 'reefer') continue
    const val = entity[field.key]
    if (!val) continue
    const nextDue = computeNextDue(field, val)
    if (!nextDue) continue
    const daysLeft = Math.ceil((nextDue.getTime() - now) / 86400000)
    if (daysLeft > THRESHOLD_DAYS) continue

    const titulo = buildTitle(field.label, daysLeft)
    const mensaje = buildMsg(field, daysLeft)

    const existing = await prisma.notificacion.findFirst({
      where: { empresaId, entidadId: entity.id, tipo, titulo, leida: false },
    })
    if (existing) continue

    const entidadTipo = tipo === 'compliance_driver' ? 'conductor' : 'camion'
    await prisma.notificacion.create({
      data: { empresaId, tipo, titulo, mensaje, entidadTipo, entidadId: entity.id },
    })
  }
}

async function runForEmpresa(empresaId) {
  const [conductores, camiones] = await Promise.all([
    prisma.conductor.findMany({ where: { empresaId } }),
    prisma.camion.findMany({ where: { empresaId } }),
  ])

  for (const conductor of conductores) {
    await checkEntity(
      empresaId, conductor, DRIVER_FIELDS, 'compliance_driver',
      (field, daysLeft) => buildDriverMessage(conductor.nombre, field, daysLeft)
    )
  }

  for (const camion of camiones) {
    await checkEntity(
      empresaId, camion, TRUCK_FIELDS, 'compliance_truck',
      (field, daysLeft) => buildTruckMessage(camion.placa, field, daysLeft)
    )
  }
}

export async function runNotificacionesJob() {
  try {
    const empresas = await prisma.empresa.findMany({ select: { id: true } })
    for (const empresa of empresas) {
      await runForEmpresa(empresa.id)
    }
    console.log(`[notificaciones] Job completed for ${empresas.length} empresa(s)`)
  } catch (err) {
    console.error('[notificaciones] Job error:', err)
  }
}

export function startNotificacionesCron() {
  runNotificacionesJob()
  cron.schedule('0 0 * * *', runNotificacionesJob)
}
