import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { notificacionesApi } from '../api/notificaciones.api'

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function TipoIcon({ tipo }) {
  if (tipo === 'compliance_driver') {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    )
  }
  if (tipo === 'compliance_truck') {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        <path d="M3 4a1 1 0 00-1 1v7a1 1 0 001 1h.5a2.5 2.5 0 015 0h3a2.5 2.5 0 015 0H17a1 1 0 001-1V9a1 1 0 00-.293-.707l-2-2A1 1 0 0015 6h-2V5a1 1 0 00-1-1H3z" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  )
}

function NotifRow({ notif, onRead }) {
  const navigate = useNavigate()

  function handleClick() {
    onRead(notif.id)
    if (notif.entidadTipo === 'conductor' && notif.entidadId) {
      navigate(`/conductores/${notif.entidadId}`)
    } else if (notif.entidadTipo === 'camion' && notif.entidadId) {
      navigate(`/flota/${notif.entidadId}`)
    }
  }

  const colorCls = notif.leida ? 'text-text-muted' : 'text-yellow-400'

  return (
    <div
      onClick={handleClick}
      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-surface-2 transition-colors border-b border-border-dim last:border-0 ${
        !notif.leida ? 'border-l-2 border-l-gold bg-gold/5' : ''
      }`}
    >
      <span className={`mt-0.5 ${colorCls}`}>
        <TipoIcon tipo={notif.tipo} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${notif.leida ? 'text-text-muted' : 'text-text-primary'}`}>
          {notif.titulo}
        </p>
        <p className="text-xs text-text-muted mt-0.5 leading-snug">{notif.mensaje}</p>
        <p className="text-xs text-text-muted/60 mt-1">{timeAgo(notif.creadoEn)}</p>
      </div>
      {!notif.leida && <span className="w-2 h-2 rounded-full bg-gold shrink-0 mt-1.5" />}
    </div>
  )
}

export function NotificacionesDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const qc = useQueryClient()

  const { data: countData } = useQuery({
    queryKey: ['notificaciones-count'],
    queryFn: notificacionesApi.count,
    refetchInterval: 60000,
  })

  const { data: notifs = [] } = useQuery({
    queryKey: ['notificaciones'],
    queryFn: notificacionesApi.list,
    enabled: open,
  })

  const marcarLeidaMut = useMutation({
    mutationFn: notificacionesApi.marcarLeida,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificaciones'] })
      qc.invalidateQueries({ queryKey: ['notificaciones-count'] })
    },
  })

  const marcarTodasMut = useMutation({
    mutationFn: notificacionesApi.marcarTodasLeidas,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificaciones'] })
      qc.invalidateQueries({ queryKey: ['notificaciones-count'] })
    },
  })

  useEffect(() => {
    if (!open) return
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onEsc(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const unread = countData?.unread ?? 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-2.83-2h5.66A3 3 0 0110 18z" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border-dim rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-dim">
            <h3 className="font-serif text-sm text-text-primary">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={() => marcarTodasMut.mutate()}
                disabled={marcarTodasMut.isPending}
                className="text-xs text-gold hover:opacity-70 transition-opacity"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-text-muted text-sm">No new notifications</p>
              </div>
            ) : (
              notifs.map(n => (
                <NotifRow
                  key={n.id}
                  notif={n}
                  onRead={(id) => { marcarLeidaMut.mutate(id); setOpen(false) }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
