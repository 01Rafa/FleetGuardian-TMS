import api from './axios'

export const brokersApi = {
  search: (q) => api.get('/brokers', { params: { q } }).then(r => r.data),
  list: () => api.get('/brokers').then(r => r.data),
  create: (nombre) => api.post('/brokers', { nombre }).then(r => r.data),
}
