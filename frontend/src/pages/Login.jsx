import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError(t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-gold">Fleet Guardian</h1>
          <p className="text-text-muted text-sm mt-2">Transportation Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface border border-border-dim rounded-2xl p-8 space-y-5">
          <div>
            <label className="block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-gold transition-colors"
              placeholder="admin@demo.com"
              required
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-gold transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-bg-deep font-semibold py-2.5 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {loading ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </form>
        <p className="text-center text-text-muted text-sm mt-5">
          Don't have an account?{' '}
          <Link to="/register" className="text-gold hover:opacity-75 transition-opacity font-medium">
            Create new account
          </Link>
        </p>
      </div>
    </div>
  )
}
