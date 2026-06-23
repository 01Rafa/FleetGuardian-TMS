import api from './axios'

export const rateconApi = {
  extract: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/ratecon/extract', formData).then(r => r.data)
  },
}
