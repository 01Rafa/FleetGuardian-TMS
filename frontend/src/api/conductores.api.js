import api from './axios'
export const conductoresApi = {
  list: () => api.get('/conductores').then(r => r.data),
  get: (id) => api.get(`/conductores/${id}`).then(r => r.data),
  create: (data) => api.post('/conductores', data).then(r => r.data),
  update: (id, data) => api.put(`/conductores/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/conductores/${id}`).then(r => r.data),
  lastLocation: (id) => api.get(`/conductores/${id}/last-location`).then(r => r.data),
}
