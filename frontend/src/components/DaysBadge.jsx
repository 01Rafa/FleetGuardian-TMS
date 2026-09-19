import { useState } from 'react'

export function DaysBadge({ nextDue }) {
  const [now] = useState(() => Date.now())
  if (!nextDue) return null
  const daysLeft = Math.ceil((nextDue.getTime() - now) / 86400000)
  const cls = daysLeft < 0 ? 'bg-danger/10 text-danger border-danger/30'
    : daysLeft <= 30 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
    : 'bg-success/10 text-success border-success/30'
  const badge = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Today' : `${daysLeft}d`
  return <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${cls}`}>{badge}</span>
}
