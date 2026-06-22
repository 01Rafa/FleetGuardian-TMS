import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { vueltasApi } from '../api/vueltas.api'

export default function Reportes() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState('weekly')

  const now = new Date()
  const fechaDesde = new Date(now)
  if (period === 'weekly') fechaDesde.setDate(now.getDate() - 7)
  else fechaDesde.setDate(now.getDate() - 30)

  const { data: vueltas = [] } = useQuery({
    queryKey: ['vueltas', 'reportes', period],
    queryFn: () => vueltasApi.list({ fechaDesde: fechaDesde.toISOString().split('T')[0] }),
  })

  const byCamion = Object.values(
    vueltas.reduce((acc, v) => {
      const key = v.camion?.placa ?? 'Sin placa'
      if (!acc[key]) acc[key] = { placa: key, ingreso: 0, gasto: 0, rentabilidad: 0 }
      acc[key].ingreso += v.ingresoTotal
      acc[key].gasto += v.gastoTotal
      acc[key].rentabilidad += v.rentabilidadNeta
      return acc
    }, {})
  )

  const topRoutes = vueltas
    .map(v => {
      const lastLeg = v.tramos?.[v.tramos.length - 1]
      return { ruta: `${v.baseSalida} → ${lastLeg?.destino ?? '…'}`, rentabilidad: v.rentabilidadNeta, codigo: v.codigo }
    })
    .sort((a, b) => b.rentabilidad - a.rentabilidad)
    .slice(0, 5)

  const tooltipStyle = { background: '#161616', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl text-text-primary">{t('reports.title')}</h2>
        <div className="flex gap-2">
          {['weekly', 'monthly'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${period === p ? 'bg-gold text-bg-deep font-semibold' : 'bg-surface border border-border-dim text-text-muted hover:text-text-primary'}`}
            >
              {p === 'weekly' ? t('reports.weekly') : t('reports.monthly')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <h3 className="font-serif text-lg text-text-primary mb-4">{t('reports.incomeByCamion')}</h3>
        {byCamion.length === 0 ? <p className="text-text-muted text-sm">{t('reports.noData')}</p> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byCamion}>
              <XAxis dataKey="placa" tick={{ fill: '#888580', fontSize: 12 }} />
              <YAxis tick={{ fill: '#888580', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => `$ ${v.toLocaleString('en-US')}`} />
              <Bar dataKey="ingreso" name={t('reports.income')} fill="#C9A84C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gasto" name={t('reports.expense')} fill="#E05252" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-surface border border-border-dim rounded-xl p-5">
        <h3 className="font-serif text-lg text-text-primary mb-4">{t('reports.topTrips')}</h3>
        <div className="space-y-2">
          {topRoutes.map((r, i) => (
            <div key={r.codigo} className="flex items-center justify-between p-3 bg-surface-2 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-gold text-sm font-bold w-5">{i + 1}</span>
                <div>
                  <p className="text-text-primary text-sm">{r.codigo}</p>
                  <p className="text-text-muted text-xs">{r.ruta}</p>
                </div>
              </div>
              <span className={`font-medium text-sm ${r.rentabilidad >= 0 ? 'text-success' : 'text-danger'}`}>
                ${r.rentabilidad.toLocaleString('en-US')}
              </span>
            </div>
          ))}
          {topRoutes.length === 0 && <p className="text-text-muted text-sm">{t('reports.noData')}</p>}
        </div>
      </div>
    </div>
  )
}
