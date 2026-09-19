import { computeComplianceStatus } from './compliance.js'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

export const TRAILER_COMPLIANCE_FIELDS = [
  { key: 'dotInspectionLastDate', label: 'DOT Annual Inspection', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'stateInspectionLastDate', label: 'State Inspection', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'brakeInspectionLastDate', label: 'Brake Inspection', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'registrationExpiry', label: 'Registration', type: 'expiry', verb: 'expires' },
  { key: 'cargoInsuranceExpiry', label: 'Cargo Insurance', type: 'expiry', verb: 'expires' },
  { key: 'epaRefrigerantExpiry', label: 'EPA Refrigerant Cert', type: 'expiry', verb: 'expires', reeferOnly: true },
]

export function getTrailerComplianceStatus(trailer) {
  return computeComplianceStatus(trailer, TRAILER_COMPLIANCE_FIELDS)
}
