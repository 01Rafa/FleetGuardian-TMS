import { useState } from 'react'
import { DatePicker } from './DatePicker'
import { DaysBadge } from './DaysBadge'
import { computeNextDue } from '../utils/compliance'
import { fmtDate, fmtDateUS, toInputDate } from '../utils/format'

export function ComplianceSection({ entity, fields, onSave, readOnly = false }) {
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({})
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const visible = fields.filter(f => !f.reeferOnly || entity.tipo === 'reefer')

  const start = () => {
    const next = {}
    for (const f of fields) next[f.key] = toInputDate(entity[f.key])
    setForm(next)
    setEdit(true)
    setError(null)
  }

  const save = async () => {
    const data = {}
    for (const f of fields) data[f.key] = form[f.key] ? new Date(form[f.key]).toISOString() : null
    setSaving(true)
    try {
      await onSave(data)
      setEdit(false)
      setError(null)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface border border-border-dim rounded-xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-serif text-lg text-text-primary">Compliance & Registrations</h3>
        {readOnly ? null : !edit ? (
          <button onClick={start} className="text-xs text-gold border border-gold/30 rounded px-3 py-1 hover:opacity-70 transition-opacity">
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setEdit(false); setError(null) }} className="text-xs text-text-muted border border-border-dim rounded px-3 py-1 hover:text-text-primary">
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              className="text-xs bg-gold text-bg-deep font-semibold px-3 py-1 rounded hover:opacity-90 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      {edit ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map(compField => {
            const currentVal = form[compField.key] ?? ''
            const nextDue = compField.type === 'interval' && currentVal ? computeNextDue(compField, currentVal) : null
            return (
              <div key={compField.key}>
                <label className="text-text-muted text-xs uppercase tracking-wide block mb-1">
                  {compField.label}
                  <span className="normal-case ml-1 text-text-muted/60">({compField.type === 'interval' ? 'last completed' : 'expiry date'})</span>
                </label>
                <DatePicker value={currentVal} onChange={v => setForm(f => ({ ...f, [compField.key]: v }))} />
                {nextDue && (
                  <p className="text-text-muted text-xs mt-0.5">Next due: {fmtDateUS(nextDue)}</p>
                )}
              </div>
            )
          })}
          {error && <p className="md:col-span-2 text-danger text-sm">{error}</p>}
        </div>
      ) : (
        <div className="divide-y divide-border-dim">
          {visible.map(compField => {
            const val = entity[compField.key]
            const nextDue = computeNextDue(compField, val)
            return (
              <div key={compField.key} className="flex items-start justify-between py-2.5">
                <p className="text-text-muted text-sm w-44 shrink-0">{compField.label}</p>
                <div className="text-right">
                  {compField.type === 'interval' ? (
                    val ? (
                      <>
                        <p className="text-text-muted text-xs">Last: {fmtDate(val)}</p>
                        <div className="flex items-center gap-2 justify-end mt-0.5">
                          <p className="text-text-primary text-sm">Next: {nextDue ? fmtDate(nextDue) : '–'}</p>
                          <DaysBadge nextDue={nextDue} />
                        </div>
                      </>
                    ) : (
                      <p className="text-text-muted text-sm">–</p>
                    )
                  ) : (
                    <div className="flex items-center gap-2 justify-end">
                      <p className="text-text-primary text-sm">{val ? fmtDate(val) : '–'}</p>
                      <DaysBadge nextDue={nextDue} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
