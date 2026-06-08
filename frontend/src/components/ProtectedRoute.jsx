import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen bg-bg-base"><div className="text-gold text-lg">Cargando...</div></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}
