import { computeNextDue } from './compliance.js'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000
const TWO_YEAR_MS = 2 * YEAR_MS

export const TRUCK_COMPLIANCE_FIELDS = [
  { key: 'dotInspectionLastDate', label: 'DOT Annual Inspection', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'stateInspectionLastDate', label: 'State Inspection', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'brakeInspectionLastDate', label: 'Brake Inspection', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'ucrLastDate', label: 'UCR Registration', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'dotBiennualUpdate', label: 'DOT Biennial Update', type: 'interval', verb: 'due', intervalMs: TWO_YEAR_MS },
  { key: 'registrationExpiry', label: 'Registration', type: 'expiry', verb: 'expires' },
  { key: 'iftaExpiry', label: 'IFTA License', type: 'expiry', verb: 'expires' },
  { key: 'irpExpiry', label: 'IRP Plate', type: 'expiry', verb: 'expires' },
  { key: 'liabilityInsuranceExpiry', label: 'Liability Insurance', type: 'expiry', verb: 'expires' },
  { key: 'cargoInsuranceExpiry', label: 'Cargo Insurance', type: 'expiry', verb: 'expires' },
  { key: 'bobtailInsuranceExpiry', label: 'Bobtail Insurance', type: 'expiry', verb: 'expires' },
  { key: 'epaRefrigerantExpiry', label: 'EPA Refrigerant Cert', type: 'expiry', verb: 'expires', reeferOnly: true },
]

export function getTruckComplianceStatus(camion) {
  const now = Date.now()
  const fields = TRUCK_COMPLIANCE_FIELDS.filter(f => !f.reeferOnly || camion.tipo === 'reefer')
  const items = fields
    .map(field => {
      const val = camion[field.key]
      if (!val) return null
      const nextDue = computeNextDue(field, val)
      if (!nextDue) return null
      const daysLeft = Math.ceil((nextDue.getTime() - now) / 86400000)
      return { ...field, nextDue, daysLeft }
    })
    .filter(Boolean)
  const expired = items.filter(i => i.daysLeft < 0)
  const expiringSoon = items.filter(i => i.daysLeft >= 0 && i.daysLeft <= 30)
  if (expired.length > 0) {
    const closest = expired.reduce((a, b) => b.daysLeft > a.daysLeft ? b : a)
    return { status: 'red', closest }
  }
  if (expiringSoon.length > 0) {
    const closest = expiringSoon.reduce((a, b) => a.daysLeft < b.daysLeft ? a : b)
    return { status: 'yellow', closest }
  }
  return { status: 'green', closest: null }
}
