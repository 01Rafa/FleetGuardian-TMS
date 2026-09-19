import api from './axios'

export const registrationApi = {
  extract: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/registration/extract', formData).then(r => r.data)
  },
}
