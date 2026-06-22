import { useState, useEffect, useRef } from 'react'
import { routingApi } from '../api/routing.api'

export function useRouteDistance(origen, destino) {
  const [distanceMillas, setDistanceMillas] = useState(null)
  const [distanceKm, setDistanceKm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)
  const prevRef = useRef({ origen: '', destino: '' })

  useEffect(() => {
    const origenClean = (origen ?? '').trim()
    const destinoClean = (destino ?? '').trim()

    // Only trigger when both fields have >=5 chars
    if (origenClean.length < 5 || destinoClean.length < 5) return

    // Only trigger if value actually changed
    if (origenClean === prevRef.current.origen && destinoClean === prevRef.current.destino) return

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      prevRef.current = { origen: origenClean, destino: destinoClean }
      setLoading(true)
      setError(null)
      try {
        const { distanceMillas: dm, distanceKm: dk } = await routingApi.getDistance(origenClean, destinoClean)
        setDistanceMillas(dm)
        setDistanceKm(dk)
      } catch {
        setError('No se pudo calcular — ingresa las millas manualmente')
        setDistanceMillas(null)
        setDistanceKm(null)
      } finally {
        setLoading(false)
      }
    }, 800)

    return () => clearTimeout(timerRef.current)
  }, [origen, destino])

  return { distanceMillas, distanceKm, loading, error }
}
