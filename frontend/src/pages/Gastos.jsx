export default function Gastos() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-5 max-w-sm">
        <div
          className="mx-auto flex items-center justify-center rounded-full"
          style={{ width: 72, height: 72, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}
        >
          <i className="ti ti-receipt" style={{ fontSize: 32, color: '#C9A84C' }} />
        </div>

        <div>
          <span
            className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-3"
            style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.25)' }}
          >
            Coming Soon · Próximamente
          </span>
          <h2 className="font-serif text-2xl text-text-primary mb-2">Expenses · Gastos</h2>
          <p className="text-text-muted text-sm leading-relaxed">
            This module is currently under development.
            <br />
            Este módulo está actualmente en desarrollo.
          </p>
        </div>
      </div>
    </div>
  )
}
