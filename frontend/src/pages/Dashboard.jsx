import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardApi } from '../api/dashboard.api'
import { vueltasApi } from '../api/vueltas.api'

const fmtMoney = (n) => Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })

function computeDelta(current, prev) {
  if (!prev || prev === 0) return null
  return ((current - prev) / Math.abs(prev)) * 100
}

function DeltaBadge({ pct, inverted = false }) {
  if (pct === null || pct === undefined) {
    return <span className="text-[10px] text-transparent select-none">—</span>
  }
  const isGood = inverted ? pct <= 0 : pct >= 0
  const arrow = pct >= 0 ? '↑' : '↓'
  return (
    <span className={`text-[10px] ${isGood ? 'text-success' : 'text-danger'}`}>
      {arrow} {Math.abs(pct).toFixed(1)}% vs last wk
    </span>
  )
}

function MiniStat({ label, value, delta, inverted }) {
  return (
    <div className="bg-surface border border-border-dim rounded-xl p-4 flex flex-col gap-1" style={{ minHeight: 86 }}>
      <p className="text-[11px] uppercase tracking-wide text-text-muted leading-none">{label}</p>
      <p className="text-2xl text-gold font-semibold leading-tight mt-0.5">{value}</p>
      <DeltaBadge pct={delta} inverted={inverted} />
    </div>
  )
}

const TRIP_STATUS = {
  planificada: { label: 'Planned', cls: 'bg-surface-2 text-text-muted' },
  en_curso: { label: 'In Progress', cls: 'bg-gold/10 text-gold' },
  completada: { label: 'Completed', cls: 'bg-success/10 text-success' },
  facturada: { label: 'Invoiced', cls: 'bg-blue-500/10 text-blue-400' },
}

function TripRow({ v, navigate }) {
  const lastDestino = v.tramos?.at(-1)?.destino ?? '—'
  const loadNum = v.tramos?.[0]?.numeroCarga ?? v.codigo ?? '—'
  const origin = v.baseSalida ?? '?'
  const route = origin !== lastDestino ? `${origin} → ${lastDestino}` : origin
  const driverName = v.conductorPrincipal?.nombre?.split(' ')[0] ?? '—'
  const truck = v.camion?.placa ?? '—'
  const statusInfo = TRIP_STATUS[v.estado] ?? { label: v.estado, cls: 'bg-surface-2 text-text-muted' }

  return (
    <tr
      onClick={() => navigate(`/vueltas/${v.id}`)}
      className="border-b border-border-dim last:border-0 cursor-pointer hover:bg-surface-2 transition-colors"
    >
      <td className="py-2 px-2 text-text-muted text-[11px] font-mono whitespace-nowrap">{loadNum}</td>
      <td className="py-2 px-2 text-text-primary text-xs max-w-[150px]">
        <span className="block truncate">{route}</span>
      </td>
      <td className="py-2 px-2 text-text-muted text-[11px] whitespace-nowrap">{truck} / {driverName}</td>
      <td className="py-2 px-2 text-right text-success text-xs font-medium whitespace-nowrap">
        $ {Number(v.ingresoTotal ?? 0).toLocaleString('en-US')}
      </td>
      <td className="py-2 px-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${statusInfo.cls}`}>
          {statusInfo.label}
        </span>
      </td>
    </tr>
  )
}


function UtilBar({ label, current, total, colorCls = 'bg-gold' }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-text-muted text-[11px]">{label}</span>
        <span className="text-text-primary text-[11px] font-medium">{current} / {total}</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div className={`h-full ${colorCls} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()

  const { data: stats } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.stats })

  const { data: activeTrips = [] } = useQuery({
    queryKey: ['vueltas', 'activas'],
    queryFn: () => vueltasApi.list({ estado: 'en_curso' }),
  })

  const { data: completedTrips = [] } = useQuery({
    queryKey: ['vueltas', 'completadas'],
    queryFn: () => vueltasApi.list({ estado: 'completada' }),
  })

  const recentTrips = completedTrips.slice(0, 5)
  const displayedActive = activeTrips.slice(0, 8)

  const incomeDelta = computeDelta(stats?.ingresoSemana, stats?.prevIngresoSemana)
  const expenseDelta = computeDelta(stats?.gastoSemana, stats?.prevGastoSemana)
  const profitDelta = computeDelta(stats?.rentabilidadSemana, stats?.prevRentabilidadSemana)

  const weekRevPct =
    stats?.prevIngresoSemana > 0
      ? Math.min(Math.round((stats.ingresoSemana / stats.prevIngresoSemana) * 100), 150)
      : null
  const weekRevColor =
    weekRevPct === null ? 'bg-surface-2' : weekRevPct >= 100 ? 'bg-success' : weekRevPct >= 75 ? 'bg-gold' : 'bg-danger'

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-5 gap-3">
        <MiniStat label="Active Trips" value={stats?.vueltasActivas ?? 0} delta={null} />
        <MiniStat label="Week Income" value={`$ ${fmtMoney(stats?.ingresoSemana)}`} delta={incomeDelta} />
        <MiniStat label="Week Expense" value={`$ ${fmtMoney(stats?.gastoSemana)}`} delta={expenseDelta} inverted />
        <MiniStat label="Net Profit" value={`$ ${fmtMoney(stats?.rentabilidadSemana)}`} delta={profitDelta} />
        <MiniStat
          label="Trucks on Route"
          value={`${stats?.camionesEnRuta ?? 0} / ${stats?.totalCamiones ?? 0}`}
          delta={null}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-4">
        {/* Left column */}
        <div className="col-span-2 space-y-4 min-w-0">
          {/* Active Trips */}
          <div className="bg-surface border border-border-dim rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-sm text-text-primary">Active Trips</h3>
              <button
                onClick={() => navigate('/vueltas?estado=en_curso')}
                className="text-[11px] text-gold hover:opacity-70 transition-opacity"
              >
                View all →
              </button>
            </div>
            {displayedActive.length === 0 ? (
              <p className="text-text-muted text-xs py-4 text-center">No active trips</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-dim">
                      <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wide text-text-muted font-normal">Load #</th>
                      <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wide text-text-muted font-normal">Route</th>
                      <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wide text-text-muted font-normal">Truck / Driver</th>
                      <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wide text-text-muted font-normal text-right">Rate</th>
                      <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wide text-text-muted font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedActive.map(v => (
                      <TripRow key={v.id} v={v} navigate={navigate} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Trips */}
          <div className="bg-surface border border-border-dim rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-sm text-text-primary">Recent Trips</h3>
              <button
                onClick={() => navigate('/vueltas?estado=completada')}
                className="text-[11px] text-gold hover:opacity-70 transition-opacity"
              >
                View all →
              </button>
            </div>
            {recentTrips.length === 0 ? (
              <p className="text-text-muted text-xs py-4 text-center">No completed trips yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-dim">
                      <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wide text-text-muted font-normal">Load #</th>
                      <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wide text-text-muted font-normal">Route</th>
                      <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wide text-text-muted font-normal">Truck / Driver</th>
                      <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wide text-text-muted font-normal text-right">Rate</th>
                      <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wide text-text-muted font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrips.map(v => (
                      <TripRow key={v.id} v={v} navigate={navigate} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-1 space-y-4 min-w-0">
          {/* Fleet Utilization */}
          <div className="bg-surface border border-border-dim rounded-xl p-4">
            <h3 className="font-serif text-sm text-text-primary mb-3">Fleet Utilization</h3>
            <div className="space-y-3">
              <UtilBar
                label="On Route"
                current={stats?.camionesEnRuta ?? 0}
                total={stats?.totalCamiones ?? 1}
                colorCls="bg-gold"
              />
              {weekRevPct !== null && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-text-muted text-[11px]">Revenue vs Last Wk</span>
                    <span className="text-text-primary text-[11px] font-medium">{weekRevPct}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${weekRevColor} rounded-full transition-all`}
                      style={{ width: `${Math.min(weekRevPct, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
