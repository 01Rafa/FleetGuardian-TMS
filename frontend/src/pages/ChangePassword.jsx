import { useState } from 'react'
import { authApi } from '../api/auth.api'

export default function ChangePassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await authApi.changePassword(password, confirmPassword)
      // Full reload lets refreshSession() re-fetch the updated user (mustChangePassword: false)
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-gold">Fleet Guardian</h1>
          <p className="text-text-muted text-sm mt-2">Please set a new password to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface border border-border-dim rounded-2xl p-8 space-y-5">
          <div>
            <label className="block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-gold transition-colors"
              placeholder="Min. 8 characters"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Saving…' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
