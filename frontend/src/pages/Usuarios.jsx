import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { usuariosApi } from '../api/usuarios.api'

const ROLES = ['admin', 'dispatcher', 'viewer']

const ROLE_STYLE = {
  admin: 'bg-gold/15 text-gold border-gold/30',
  dispatcher: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  viewer: 'bg-surface-2 text-text-muted border-border-dim',
}

function RoleBadge({ rol }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${ROLE_STYLE[rol] ?? ROLE_STYLE.viewer}`}>
      {rol}
    </span>
  )
}

function InviteModal({ onClose }) {
  const qc = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('dispatcher')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: usuariosApi.invite,
    onSuccess: (data) => {
      setCreated(data)
      qc.invalidateQueries({ queryKey: ['usuarios'] })
    },
    onError: (err) => setError(err.response?.data?.error ?? 'Failed to create user'),
  })

  function handleCopy() {
    navigator.clipboard.writeText(created.tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputCls = 'w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold transition-colors'
  const labelCls = 'block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5'

  if (created) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-success text-lg">✓</span>
          <h3 className="font-serif text-lg text-text-primary">User created</h3>
        </div>
        <p className="text-text-muted text-sm">
          Share the temporary password with <strong className="text-text-primary">{created.nombre}</strong>. They should change it after first login.
        </p>
        <div>
          <p className={labelCls}>Temporary password</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-gold text-sm font-mono select-all">
              {created.tempPassword}
            </code>
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-gold/10 border border-gold/30 text-gold text-xs font-medium rounded-lg hover:bg-gold/20 transition-colors whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-gold text-bg-deep font-semibold py-2.5 rounded-lg hover:bg-gold/90 transition-colors text-sm"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); setError(''); mutation.mutate({ nombre, email, rol }) }}
      className="space-y-4"
    >
      <h3 className="font-serif text-lg text-text-primary">Invite User</h3>
      <div>
        <label className={labelCls}>Full name *</label>
        <input className={inputCls} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Jane Smith" required />
      </div>
      <div>
        <label className={labelCls}>Email *</label>
        <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" required />
      </div>
      <div>
        <label className={labelCls}>Role</label>
        <select
          className={inputCls}
          value={rol}
          onChange={e => setRol(e.target.value)}
        >
          <option value="admin">Admin — full access</option>
          <option value="dispatcher">Dispatcher — create & edit trips, drivers, trucks</option>
          <option value="viewer">Viewer — read only</option>
        </select>
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-border-dim text-text-muted hover:text-text-primary text-sm transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex-1 py-2 rounded-lg bg-gold text-bg-deep font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? 'Creating…' : 'Create Account'}
        </button>
      </div>
    </form>
  )
}

function EditRoleModal({ user, onClose }) {
  const qc = useQueryClient()
  const [rol, setRol] = useState(user.rol)

  const mutation = useMutation({
    mutationFn: (newRol) => usuariosApi.updateRol(user.id, newRol),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); onClose() },
    onError: (err) => console.error(err),
  })

  return (
    <div className="space-y-4">
      <h3 className="font-serif text-lg text-text-primary">Edit Role</h3>
      <p className="text-text-muted text-sm">{user.nombre} · {user.email}</p>
      <div>
        <label className="block text-text-muted text-xs font-medium uppercase tracking-wide mb-1.5">Role</label>
        <select
          className="w-full bg-surface-2 border border-border-dim rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-gold transition-colors"
          value={rol}
          onChange={e => setRol(e.target.value)}
        >
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-border-dim text-text-muted hover:text-text-primary text-sm transition-colors">
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate(rol)}
          disabled={mutation.isPending || rol === user.rol}
          className="flex-1 py-2 rounded-lg bg-gold text-bg-deep font-semibold text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface border border-border-dim rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {children}
      </div>
    </div>
  )
}

export default function Usuarios() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'invite' | { type: 'editRole', user } | { type: 'delete', user }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosApi.list,
  })

  const deleteMut = useMutation({
    mutationFn: usuariosApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); setModal(null) },
    onError: (err) => alert(err.response?.data?.error ?? 'Failed to delete user'),
  })

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-text-primary">Team Members</h2>
          <p className="text-text-muted text-sm mt-0.5">{users.length} user{users.length !== 1 ? 's' : ''} in your company</p>
        </div>
        <button
          onClick={() => setModal('invite')}
          className="bg-gold text-bg-deep font-semibold px-4 py-2 rounded-lg hover:bg-gold/90 transition-colors text-sm"
        >
          + Invite User
        </button>
      </div>

      <div className="bg-surface border border-border-dim rounded-xl overflow-hidden">
        {isLoading ? (
          <p className="text-text-muted text-sm p-6">Loading…</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-dim">
                <th className="px-5 py-3 text-[11px] uppercase tracking-wide text-text-muted font-normal">Name</th>
                <th className="px-5 py-3 text-[11px] uppercase tracking-wide text-text-muted font-normal">Email</th>
                <th className="px-5 py-3 text-[11px] uppercase tracking-wide text-text-muted font-normal">Role</th>
                <th className="px-5 py-3 text-[11px] uppercase tracking-wide text-text-muted font-normal">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-border-dim last:border-0 hover:bg-surface-2 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-gold text-xs font-bold shrink-0">
                        {u.nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                      </div>
                      <span className="text-text-primary text-sm font-medium">
                        {u.nombre}
                        {u.id === me?.id && <span className="text-text-muted text-xs ml-1.5">(you)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-text-muted text-sm">{u.email}</td>
                  <td className="px-5 py-3"><RoleBadge rol={u.rol} /></td>
                  <td className="px-5 py-3 text-text-muted text-xs">{fmtDate(u.creadoEn)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setModal({ type: 'editRole', user: u })}
                        className="text-xs text-text-muted hover:text-gold transition-colors px-2 py-1 rounded hover:bg-gold/5"
                      >
                        Edit role
                      </button>
                      {u.id !== me?.id && (
                        <button
                          onClick={() => setModal({ type: 'delete', user: u })}
                          className="text-xs text-text-muted hover:text-danger transition-colors px-2 py-1 rounded hover:bg-danger/5"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal === 'invite' && (
        <Modal onClose={() => setModal(null)}>
          <InviteModal onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'editRole' && (
        <Modal onClose={() => setModal(null)}>
          <EditRoleModal user={modal.user} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal onClose={() => setModal(null)}>
          <div className="space-y-4">
            <h3 className="font-serif text-lg text-text-primary">Remove user?</h3>
            <p className="text-text-muted text-sm">
              This will permanently remove <strong className="text-text-primary">{modal.user.nombre}</strong> from your team. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg border border-border-dim text-text-muted hover:text-text-primary text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(modal.user.id)}
                disabled={deleteMut.isPending}
                className="flex-1 py-2 rounded-lg bg-danger text-white font-semibold text-sm hover:bg-danger/90 transition-colors disabled:opacity-50"
              >
                {deleteMut.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
