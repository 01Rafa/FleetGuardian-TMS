import api from './axios'

export const cdlApi = {
  extract: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/cdl/extract', formData).then(r => r.data)
  },
}
