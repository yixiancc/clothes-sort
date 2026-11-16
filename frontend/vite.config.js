import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true, // 手机与电脑同一局域网时可用手机访问调试
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://clothessortback.yixianluoshui.top',
        changeOrigin: true,
      },
    },
  },
})
