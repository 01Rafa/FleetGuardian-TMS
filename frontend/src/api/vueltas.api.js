import api from './axios'

export const sugerenciasApi = {
  byConductor: (conductorId) => api.get('/sugerencias', { params: { conductorId } }).then(r => r.data),
  byCamion: (camionId) => api.get('/sugerencias', { params: { camionId } }).then(r => r.data),
  byConductorPrincipal: (conductorPrincipalId) => api.get('/sugerencias', { params: { conductorPrincipalId } }).then(r => r.data),
}

export const vueltasApi = {
  list: (params) => api.get('/vueltas', { params }).then(r => r.data),
  get: (id) => api.get(`/vueltas/${id}`).then(r => r.data),
  create: (data) => api.post('/vueltas', data).then(r => r.data),
  update: (id, data) => api.put(`/vueltas/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/vueltas/${id}`).then(r => r.data),
  changeEstado: (id, estado) => api.patch(`/vueltas/${id}/estado`, { estado }).then(r => r.data),
  merge: (data) => api.post('/vueltas/merge', data).then(r => r.data),
  createTramo: (vueltaId, data) => api.post(`/vueltas/${vueltaId}/tramos`, data).then(r => r.data),
  createGasto: (vueltaId, data) => api.post(`/vueltas/${vueltaId}/gastos`, data).then(r => r.data),
}

export const tramosApi = {
  update: (id, data) => api.put(`/tramos/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/tramos/${id}`).then(r => r.data),
}

export const gastosApi = {
  update: (id, data) => api.put(`/gastos/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/gastos/${id}`).then(r => r.data),
}
