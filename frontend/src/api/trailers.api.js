import api from './axios'

export const trailersApi = {
  list: () => api.get('/trailers').then(r => r.data),
  get: (id) => api.get(`/trailers/${id}`).then(r => r.data),
  create: (data) => api.post('/trailers', data).then(r => r.data),
  update: (id, data) => api.put(`/trailers/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/trailers/${id}`).then(r => r.data),
  createMantenimiento: (trailerId, data) => api.post(`/trailers/${trailerId}/mantenimientos`, data).then(r => r.data),
  createPieza: (trailerId, data) => api.post(`/trailers/${trailerId}/piezas`, data).then(r => r.data),
}
