import api from './axios'

export const routingApi = {
  getDistance: (origen, destino) =>
    api.get('/routing/distance', { params: { origen, destino } }).then(r => r.data),
}
