import { defineStore } from 'pinia'
import api from '../api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isAdmin: (s) => !!s.user?.is_admin,
  },
  actions: {
    _save(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    },
    async login(username, password) {
      const res = await api.post('/auth/login', { username, password })
      this._save(res.data.token, res.data.user)
    },
    async register(username, password, nickname, captchaId, captchaCode) {
      await api.post('/auth/register', {
        username, password, nickname,
        captcha_id: captchaId, captcha_code: captchaCode,
      })
    },
    async updateProfile(payload) {
      const res = await api.put('/auth/profile', payload)
      this.user = res.data
      localStorage.setItem('user', JSON.stringify(res.data))
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
  },
})
