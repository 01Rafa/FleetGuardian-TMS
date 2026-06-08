import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = {
  combustible: '#C9A84C',
  peaje: '#4CAF7D',
  viatico: '#60a5fa',
  mantenimiento: '#E05252',
  otro: '#888580',
}

export function GastosDonut({ gastos = [] }) {
  const grouped = gastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] ?? 0) + g.monto
    return acc
  }, {})
  const data = Object.entries(grouped).map(([name, value]) => ({ name, value }))
  if (data.length === 0) return <p className="text-text-muted text-sm">Sin gastos registrados</p>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
          {data.map((entry) => <Cell key={entry.name} fill={COLORS[entry.name] ?? '#888580'} />)}
        </Pie>
        <Tooltip
          formatter={(v) => `S/ ${v.toLocaleString('es-PE')}`}
          contentStyle={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ color: '#888580', fontSize: 12 }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
