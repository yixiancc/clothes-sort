import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue'), meta: { auth: true } },
  { path: '/outfits', name: 'outfits', component: () => import('../views/OutfitsView.vue'), meta: { auth: true } },
  { path: '/stats', name: 'stats', component: () => import('../views/StatsView.vue'), meta: { auth: true } },
  { path: '/calendar', name: 'calendar', component: () => import('../views/CalendarView.vue'), meta: { auth: true } },
  { path: '/admin', name: 'admin', component: () => import('../views/AdminView.vue'), meta: { auth: true, admin: true } },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if (to.meta.auth && !token) return { name: 'login' }
  if (to.meta.admin && !user?.is_admin) return { name: 'home' }
  if (to.name === 'login' && token) return { name: 'home' }
})

export default router
