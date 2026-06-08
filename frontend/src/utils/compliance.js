const YEAR_MS = 365 * 24 * 60 * 60 * 1000

export const COMPLIANCE_FIELDS = [
  { key: 'cdlExpiry', labelKey: 'compliance.cdlExpiry', label: 'CDL', type: 'expiry', verb: 'expires' },
  { key: 'medicalExamExpiry', labelKey: 'compliance.medicalExamExpiry', label: 'DOT Physical', type: 'expiry', verb: 'expires' },
  { key: 'hazmatExpiry', labelKey: 'compliance.hazmatExpiry', label: 'HazMat', type: 'expiry', verb: 'expires' },
  { key: 'twicExpiry', labelKey: 'compliance.twicExpiry', label: 'TWIC', type: 'expiry', verb: 'expires' },
  { key: 'drugTestLastDate', labelKey: 'compliance.drugTestLastDate', label: 'Drug Test', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'alcoholTestLastDate', labelKey: 'compliance.alcoholTestLastDate', label: 'Alcohol Test', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'mvrLastDate', labelKey: 'compliance.mvrLastDate', label: 'MVR Check', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'annualReviewDate', labelKey: 'compliance.annualReviewDate', label: 'Annual Review', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
  { key: 'safetyTrainingDate', labelKey: 'compliance.safetyTrainingDate', label: 'Safety Training', type: 'interval', verb: 'due', intervalMs: YEAR_MS },
]

export function computeNextDue(field, dateValue) {
  if (!dateValue) return null
  const date = new Date(dateValue)
  if (isNaN(date.getTime())) return null
  return field.type === 'expiry' ? date : new Date(date.getTime() + field.intervalMs)
}

export function getComplianceStatus(conductor) {
  const now = Date.now()

  const items = COMPLIANCE_FIELDS
    .map(field => {
      const val = conductor[field.key]
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
