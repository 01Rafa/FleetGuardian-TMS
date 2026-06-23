import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StatusDropdown } from './StatusDropdown'

const fmt = (n) => `$ ${Number(n ?? 0).toLocaleString('en-US')}`

export function VueltaTable({ vueltas = [], selectable = false, selectedIds = [], onToggleSelect }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const go = (id) => navigate(`/vueltas/${id}`)

  const headers = [
    t('trips.table.loadNumber'),
    t('trips.table.route'),
    t('trips.table.truck'),
    t('trips.table.driver'),
    t('trips.table.income'),
    t('trips.table.expense'),
    t('trips.table.profit'),
    t('trips.table.status'),
    '',
  ]

  return (
    <div className="overflow-x-auto rounded-xl border border-border-dim">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-dim bg-surface-2">
            {selectable && <th className="px-4 py-3 w-10"></th>}
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-left text-text-muted font-medium text-xs uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vueltas.map((v) => (
            <tr
              key={v.id}
              onClick={() => selectable ? onToggleSelect(v.id) : go(v.id)}
              className={`border-b border-border-dim last:border-0 hover:bg-surface-2 cursor-pointer transition-colors ${selectable && selectedIds.includes(v.id) ? 'bg-gold/5' : ''}`}
            >
              {selectable && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(v.id)}
                    onChange={() => onToggleSelect(v.id)}
                    onClick={e => e.stopPropagation()}
                    className="accent-gold w-4 h-4"
                  />
                </td>
              )}
              <td className="px-4 py-3 text-gold font-medium">
                {(() => {
                  const nums = [...new Set((v.tramos ?? []).map(tramo => tramo.numeroCarga).filter(Boolean))]
                  return nums.length > 0 ? nums.join(', ') : v.codigo
                })()}
              </td>
              <td className="px-4 py-3 text-text-primary">{v.tramos?.[0]?.origen ?? v.baseSalida} → {v.tramos?.[v.tramos.length - 1]?.destino ?? '...'}</td>
              <td className="px-4 py-3 text-text-muted">{v.camion?.placa}</td>
              <td className="px-4 py-3 text-text-muted">
                {v.conductorPrincipal?.nombre}
                {v.conductorSecundario && <span className="text-text-muted/60"> / {v.conductorSecundario.nombre}</span>}
              </td>
              <td className="px-4 py-3 text-success">{fmt(v.ingresoTotal)}</td>
              <td className="px-4 py-3 text-danger">{fmt(v.gastoTotal)}</td>
              <td className={`px-4 py-3 font-medium ${v.rentabilidadNeta >= 0 ? 'text-success' : 'text-danger'}`}>
                {fmt(v.rentabilidadNeta)}
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><StatusDropdown vuelta={v} /></td>
              <td className="px-4 py-3">
                {!selectable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); go(v.id) }}
                    className="text-text-muted hover:text-gold border border-border-dim hover:border-gold/30 rounded px-2 py-1 text-xs transition-colors"
                    title="Editar vuelta"
                  >
                    ✏
                  </button>
                )}
              </td>
            </tr>
          ))}
          {vueltas.length === 0 && (
            <tr><td colSpan={selectable ? 10 : 9} className="px-4 py-8 text-center text-text-muted">{t('trips.noTrips')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
