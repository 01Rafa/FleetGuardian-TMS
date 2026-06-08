import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/index.js'
import { useDistanceUnit } from '../context/DistanceUnitContext'
import { useRole } from '../hooks/useRole'

export default function Configuracion() {
  const { t } = useTranslation()
  const { isAdmin } = useRole()
  const currentLang = i18n.language?.startsWith('en') ? 'en' : 'es'
  const { unit, changeUnit } = useDistanceUnit()

  const btnCls = (active) =>
    `px-5 py-2 rounded-lg text-sm font-medium border transition-colors ${
      active
        ? 'bg-gold text-bg-deep border-gold'
        : 'bg-surface-2 text-text-muted border-border-dim hover:text-text-primary'
    }`

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="font-serif text-2xl text-text-primary">{t('settings.title')}</h2>

      <div className="bg-surface border border-border-dim rounded-xl p-5 space-y-4">
        <h3 className="font-serif text-lg text-text-primary">{t('settings.language.title')}</h3>
        <div className="flex gap-3">
          <button className={btnCls(currentLang === 'es')} onClick={() => i18n.changeLanguage('es')}>
            {t('settings.language.spanish')}
          </button>
          <button className={btnCls(currentLang === 'en')} onClick={() => i18n.changeLanguage('en')}>
            {t('settings.language.english')}
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border-dim rounded-xl p-5 space-y-4">
        <h3 className="font-serif text-lg text-text-primary">{t('settings.distance.title')}</h3>
        <div className="flex gap-3">
          <button className={btnCls(unit === 'mi')} onClick={() => changeUnit('mi')}>
            {t('settings.distance.miles')}
          </button>
          <button className={btnCls(unit === 'km')} onClick={() => changeUnit('km')}>
            {t('settings.distance.km')}
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-surface border border-border-dim rounded-xl p-5 space-y-4">
          <h3 className="font-serif text-lg text-text-primary">Team Management</h3>
          <p className="text-text-muted text-sm">Manage users, roles and access levels for your team.</p>
          <Link
            to="/configuracion/usuarios"
            className="inline-flex items-center gap-2 bg-gold/10 border border-gold/30 text-gold text-sm font-medium px-4 py-2 rounded-lg hover:bg-gold/20 transition-colors"
          >
            Manage Team Members →
          </Link>
        </div>
      )}
    </div>
  )
}
