import axios from 'axios'
import { ElMessage } from 'element-plus'

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE || '/api', timeout: 30000 })

// 请求自动带上 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 统一错误处理：token 失效（401/422）时跳转登录
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status
    const message = err.response?.data?.message || err.response?.data?.msg || '请求失败'
    if (status === 401 || status === 422) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (location.pathname !== '/login') {
        ElMessage.error('登录已过期，请重新登录')
        location.href = '/login'
      }
    }
    return Promise.reject(new Error(message))
  }
)

export default api
