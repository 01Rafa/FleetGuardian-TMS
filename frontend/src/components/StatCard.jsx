export function StatCard({ label, value, prefix = '', suffix = '', trend }) {
  return (
    <div className="bg-surface border border-border-dim rounded-xl p-5">
      <p className="text-text-muted text-xs font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className="text-gold font-serif text-3xl font-bold">
        {prefix}{typeof value === 'number' ? value.toLocaleString('en-US') : value}{suffix}
      </p>
      {trend !== undefined && (
        <p className={`text-xs mt-1 ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs semana anterior
        </p>
      )}
    </div>
  )
}
