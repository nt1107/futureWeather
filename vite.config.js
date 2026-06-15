import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 代理和风天气API请求 - 绕过域名白名单
      '/qweather-api': {
        target: 'https://devapi.qweather.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/qweather-api/, ''),
        secure: true,
        headers: {
          // 清除可能泄露来源的头
          'Referer': 'https://devapi.qweather.com/',
          'Origin': 'https://devapi.qweather.com',
        },
      },
    },
  },
})