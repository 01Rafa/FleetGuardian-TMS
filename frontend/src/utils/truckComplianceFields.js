import { computeComplianceStatus } from './compliance.js'

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
  return computeComplianceStatus(camion, TRUCK_COMPLIANCE_FIELDS)
}
