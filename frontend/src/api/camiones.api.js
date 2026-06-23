import api from './axios'

export const camionesApi = {
  list: () => api.get('/camiones').then(r => r.data),
  get: (id) => api.get(`/camiones/${id}`).then(r => r.data),
  create: (data) => api.post('/camiones', data).then(r => r.data),
  update: (id, data) => api.put(`/camiones/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/camiones/${id}`).then(r => r.data),
  createMantenimiento: (camionId, data) => api.post(`/camiones/${camionId}/mantenimientos`, data).then(r => r.data),
  createPieza: (camionId, data) => api.post(`/camiones/${camionId}/piezas`, data).then(r => r.data),
  lastLocation: (id) => api.get(`/camiones/${id}/last-location`).then(r => r.data),
}

export const mantenimientosApi = {
  update: (id, data) => api.put(`/mantenimientos/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/mantenimientos/${id}`).then(r => r.data),
}

export const piezasApi = {
  update: (id, data) => api.put(`/piezas/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/piezas/${id}`).then(r => r.data),
}
