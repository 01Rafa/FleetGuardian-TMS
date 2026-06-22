import { useTranslation } from 'react-i18next'

const styles = {
  planificada:   'bg-text-muted/20 text-text-muted border-text-muted/30',
  en_curso:      'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completada:    'bg-success/20 text-success border-success/30',
  facturada:     'bg-gold/20 text-gold border-gold/30',
  disponible:    'bg-success/20 text-success border-success/30',
  en_ruta:       'bg-gold/20 text-gold border-gold/30',
  mantenimiento: 'bg-danger/20 text-danger border-danger/30',
  activo:        'bg-success/20 text-success border-success/30',
  inactivo:      'bg-text-muted/20 text-text-muted border-text-muted/30',
  vacaciones:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

export function StatusBadge({ estado }) {
  const { t } = useTranslation()
  const label = t(`status.${estado}`, { defaultValue: estado })
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[estado] ?? 'bg-surface-2 text-text-muted border-border-dim'}`}>
      {label}
    </span>
  )
}
