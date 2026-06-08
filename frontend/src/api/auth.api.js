import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? ''

export const authApi = {
  login: async (email, password) => {
    const { data } = await axios.post(`${API_URL}/api/auth/login`, { email, password }, { withCredentials: true })
    return data
  },
  register: async (body) => {
    const { data } = await axios.post(`${API_URL}/api/auth/register`, body, { withCredentials: true })
    return data
  },
  refresh: async () => {
    const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true })
    return data
  },
  logout: async () => {
    await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true })
  },
}
