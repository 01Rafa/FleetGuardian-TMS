import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Field({ label, type = 'text', value, onChange, placeholder, required, hint }) {
  return (
    <div>
      <label className="block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5">
        {label}{required && ' *'}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-gold transition-colors"
      />
      {hint && <p className="text-text-muted text-xs mt-1">{hint}</p>}
    </div>
  )
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  // Step 1 — company
  const [companyName, setCompanyName] = useState('')
  const [dotNumber, setDotNumber] = useState('')
  const [phone, setPhone] = useState('')

  // Step 2 — user
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleStep1(e) {
    e.preventDefault()
    if (!companyName.trim()) return
    setStep(2)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await register({
        empresa: { nombre: companyName, dotNumber, phone },
        usuario: { nombre, email, password, confirmPassword },
      })
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error ?? 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-serif text-4xl text-gold">Fleet Guardian</h1>
          <p className="text-text-muted text-sm mt-2">Create your account</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                s < step ? 'bg-gold text-bg-deep' : s === step ? 'bg-gold text-bg-deep' : 'bg-surface-2 text-text-muted border border-border-dim'
              }`}>
                {s < step ? '✓' : s}
              </div>
              <span className={`text-xs ${s === step ? 'text-text-primary' : 'text-text-muted'}`}>
                {s === 1 ? 'Company' : 'Account'}
              </span>
              {s < 2 && <div className={`flex-1 h-px ${step > s ? 'bg-gold/40' : 'bg-border-dim'}`} />}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1} className="bg-surface border border-border-dim rounded-2xl p-8 space-y-5">
            <h2 className="font-serif text-lg text-text-primary">Company information</h2>
            <Field
              label="Company name"
              value={companyName}
              onChange={setCompanyName}
              placeholder="Acme Trucking LLC"
              required
            />
            <Field
              label="DOT Number"
              value={dotNumber}
              onChange={setDotNumber}
              placeholder="1234567"
            />
            <Field
              label="Phone"
              value={phone}
              onChange={setPhone}
              placeholder="+1 (555) 000-0000"
            />
            <button
              type="submit"
              disabled={!companyName.trim()}
              className="w-full bg-gold text-bg-deep font-semibold py-2.5 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-40"
            >
              Next →
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface border border-border-dim rounded-2xl p-8 space-y-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setStep(1); setError('') }}
                className="text-text-muted hover:text-text-primary transition-colors text-sm"
              >
                ← Back
              </button>
              <h2 className="font-serif text-lg text-text-primary">Admin account</h2>
            </div>
            <Field
              label="Full name"
              value={nombre}
              onChange={setNombre}
              placeholder="John Smith"
              required
            />
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="john@company.com"
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              required
              hint="Minimum 8 characters"
            />
            <Field
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="••••••••"
              required
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold text-bg-deep font-semibold py-2.5 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        <p className="text-center text-text-muted text-sm mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-gold hover:opacity-75 transition-opacity font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
