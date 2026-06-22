import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from './StatusBadge'
import { vueltasApi } from '../api/vueltas.api'

const ESTADOS = ['planificada', 'en_curso', 'completada', 'facturada']

export function StatusDropdown({ vuelta }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [displayEstado, setDisplayEstado] = useState(vuelta.estado)

  useEffect(() => { setDisplayEstado(vuelta.estado) }, [vuelta.estado])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKeyDown = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: (estado) => vueltasApi.changeEstado(vuelta.id, estado),
    onMutate: (estado) => { setDisplayEstado(estado) },
    onSuccess: () => {
      toast.success(t('trips.statusUpdated', { defaultValue: 'Estado actualizado' }))
      qc.invalidateQueries({ queryKey: ['vueltas'] })
    },
    onError: () => {
      setDisplayEstado(vuelta.estado)
      toast.error(t('trips.statusUpdateError', { defaultValue: 'Error al actualizar el estado' }))
    },
  })

  const handleSelect = (estado) => {
    setOpen(false)
    if (estado !== displayEstado) mutation.mutate(estado)
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-gold/40"
        title={t('trips.changeStatus', { defaultValue: 'Cambiar estado' })}
      >
        <StatusBadge estado={displayEstado} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] py-1 bg-surface border border-border-dim rounded-lg shadow-lg">
          {ESTADOS.map((estado) => (
            <button
              key={estado}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSelect(estado) }}
              className={`w-full px-3 py-2 text-left flex items-center hover:bg-surface-2 transition-colors ${estado === displayEstado ? 'opacity-40 cursor-default pointer-events-none' : 'cursor-pointer'}`}
            >
              <StatusBadge estado={estado} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
