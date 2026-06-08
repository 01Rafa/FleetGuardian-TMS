import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { NotificacionesDropdown } from './NotificacionesDropdown'
import { vueltasApi } from '../api/vueltas.api'

function ShieldSvg() {
  return (
    <svg width="18" height="21" viewBox="0 0 26 30" fill="none" aria-hidden="true">
      <path
        d="M13 0L0 5V14.5C0 21.8 5.7 28.7 13 30C20.3 28.7 26 21.8 26 14.5V5L13 0Z"
        fill="rgba(201,168,76,0.2)"
        stroke="#C9A84C"
        strokeWidth="1.6"
      />
      <path
        d="M8.5 15l3.5 3.5 5.5-7"
        stroke="#C9A84C"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 11,
      color: '#888580',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      paddingLeft: 16,
      paddingBottom: 4,
      paddingTop: 2,
      fontWeight: 600,
    }}>
      {children}
    </p>
  )
}

function NavItem({ to, icon, label, badge, active }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 transition-colors ${
        active
          ? 'bg-[rgba(201,168,76,0.08)] text-[#C9A84C] font-medium'
          : 'text-[#888580] hover:text-[#c2bfba] hover:bg-white/[0.03]'
      }`}
      style={{
        height: 38,
        paddingLeft: 14,
        paddingRight: 16,
        borderLeft: active ? '2px solid #C9A84C' : '2px solid transparent',
        borderRadius: '0 6px 6px 0',
        textDecoration: 'none',
        fontSize: 13,
      }}
    >
      <i className={`ti ti-${icon}`} style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }} />
      <span className="flex-1 truncate">{label}</span>
      {badge > 0 && (
        <span style={{
          background: '#C9A84C',
          color: '#0a0a0a',
          fontSize: 10,
          fontWeight: 700,
          padding: '1px 6px',
          borderRadius: 999,
          lineHeight: '16px',
          flexShrink: 0,
        }}>
          {badge}
        </span>
      )}
    </Link>
  )
}

export function Layout({ children }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: activeTrips = [] } = useQuery({
    queryKey: ['vueltas', 'activas'],
    queryFn: () => vueltasApi.list({ estado: 'en_curso' }),
    refetchInterval: 60000,
  })
  const activeCount = activeTrips.length

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  function isActive(to) {
    return pathname === to || (to !== '/dashboard' && pathname.startsWith(to))
  }

  return (
    <div className="flex h-screen bg-bg-base">
      {/* Sidebar */}
      <aside
        style={{ width: 220, background: '#0c0c0c', borderRight: '1px solid rgba(255,255,255,0.06)' }}
        className="flex-shrink-0 flex flex-col"
      >
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(201,168,76,0.1)',
              border: '1px solid rgba(201,168,76,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShieldSvg />
            </div>
            <div>
              <div className="font-serif text-gold leading-tight" style={{ fontSize: 15 }}>Fleet Guardian</div>
              <div style={{ fontSize: 9, color: '#888580', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 2 }}>
                TMS Services
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto" style={{ paddingTop: 12, paddingBottom: 8 }}>
          {/* GENERAL */}
          <div style={{ marginBottom: 4 }}>
            <SectionLabel>{t('nav.sections.general')}</SectionLabel>
            <NavItem to="/dashboard" icon="layout-dashboard" label={t('nav.dashboard')} active={isActive('/dashboard')} />
            <NavItem to="/vueltas" icon="route" label={t('nav.trips')} active={isActive('/vueltas')} badge={activeCount} />
            <NavItem to="/flota" icon="truck" label={t('nav.fleet')} active={isActive('/flota')} />
            <NavItem to="/conductores" icon="users" label={t('nav.drivers')} active={isActive('/conductores')} />
          </div>

          {/* FINANCES */}
          <div style={{ marginTop: 14, marginBottom: 4 }}>
            <SectionLabel>{t('nav.sections.finances')}</SectionLabel>
            <NavItem to="/gastos" icon="receipt" label={t('nav.expenses')} active={isActive('/gastos')} />
            <NavItem to="/facturas" icon="file-invoice" label={t('nav.invoices')} active={isActive('/facturas')} />
            <NavItem to="/reportes" icon="chart-bar" label={t('nav.reports')} active={isActive('/reportes')} />
          </div>

          {/* SYSTEM */}
          <div style={{ marginTop: 14 }}>
            <SectionLabel>{t('nav.sections.system')}</SectionLabel>
            <NavItem to="/configuracion" icon="settings" label={t('nav.settings')} active={isActive('/configuracion')} />
          </div>
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 12px 14px' }}>
          {/* User name row */}
          <div className="flex items-center gap-2 mb-3" style={{ paddingLeft: 4 }}>
            <div style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'rgba(201,168,76,0.12)',
              border: '1px solid rgba(201,168,76,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: '#C9A84C', fontSize: 9, fontWeight: 700 }}>{getInitials(user?.nombre)}</span>
            </div>
            <p style={{ color: '#c2bfba', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.nombre}
            </p>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 w-full transition-colors hover:text-danger"
            style={{
              color: '#888580',
              fontSize: 12,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '5px 4px',
            }}
          >
            <i className="ti ti-logout" style={{ fontSize: 15 }} />
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Thin header — bell only */}
        <header
          style={{ height: 48, borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0a0a0a' }}
          className="flex items-center justify-end px-4 shrink-0"
        >
          <NotificacionesDropdown />
        </header>

        <main className="flex-1 overflow-y-auto p-5">{children}</main>
      </div>
    </div>
  )
}
