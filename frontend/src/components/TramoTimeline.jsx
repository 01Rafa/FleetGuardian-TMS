import { useDistanceUnit } from '../context/DistanceUnitContext'

export function TramoTimeline({ tramos = [], baseSalida }) {
  const { unit } = useDistanceUnit()
  const stops = [baseSalida, ...tramos.map(tramo => tramo.destino)]
  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2">
      {stops.map((stop, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full border-2 ${i === 0 || i === stops.length - 1 ? 'border-gold bg-gold' : 'border-gold bg-transparent'}`} />
            <p className="text-text-primary text-xs mt-1 whitespace-nowrap max-w-[80px] text-center">{stop}</p>
            {i < tramos.length && (
              <p className="text-text-muted text-xs mt-0.5">$ {tramos[i].fleteCobrado.toLocaleString('en-US')}</p>
            )}
          </div>
          {i < stops.length - 1 && (
            <div className="flex flex-col items-center mx-1">
              <div className="h-0.5 w-16 bg-gold-dim mt-1.5" />
              <p className="text-text-muted text-xs mt-1">{tramos[i]?.kmRecorridos ?? '–'} {unit}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
