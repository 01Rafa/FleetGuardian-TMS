import api from './axios'

export const usuariosApi = {
  list: () => api.get('/usuarios').then(r => r.data),
  invite: (data) => api.post('/usuarios', data).then(r => r.data),
  updateRol: (id, rol) => api.patch(`/usuarios/${id}/rol`, { rol }).then(r => r.data),
  delete: (id) => api.delete(`/usuarios/${id}`).then(r => r.data),
}
