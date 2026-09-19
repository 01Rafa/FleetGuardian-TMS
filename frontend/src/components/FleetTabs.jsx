import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function FleetTabs() {
  const { t } = useTranslation()
  const cls = ({ isActive }) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      isActive ? 'border-gold text-gold' : 'border-transparent text-text-muted hover:text-text-primary'
    }`
  return (
    <div className="flex gap-2 border-b border-border-dim">
      <NavLink to="/flota" end className={cls}>{t('fleet.tabs.trucks')}</NavLink>
      <NavLink to="/flota/trailers" className={cls}>{t('fleet.tabs.trailers')}</NavLink>
    </div>
  )
}
