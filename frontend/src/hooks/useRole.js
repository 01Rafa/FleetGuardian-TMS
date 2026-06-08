import { useAuth } from './useAuth'

export function useRole() {
  const { user } = useAuth()
  const rol = user?.rol ?? 'viewer'
  return {
    rol,
    isAdmin: rol === 'admin',
    isDispatcher: rol === 'dispatcher',
    isViewer: rol === 'viewer',
    can: (...roles) => roles.includes(rol),
  }
}
