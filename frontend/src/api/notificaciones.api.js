import api from './axios'

export const notificacionesApi = {
  list: () => api.get('/notificaciones').then(r => r.data),
  count: () => api.get('/notificaciones/count').then(r => r.data),
  marcarLeida: (id) => api.patch(`/notificaciones/${id}/leer`).then(r => r.data),
  marcarTodasLeidas: () => api.patch('/notificaciones/leer-todas').then(r => r.data),
}
