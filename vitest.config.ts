import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'
import viteReact from '@vitejs/plugin-react'

const { plugins: _, ...rest } = viteConfig

export default defineConfig({
  ...rest,
  plugins: [viteReact()],
  test: {
    server: {
      deps: {
        inline: ['react', 'react-dom'],
      },
    },
  },
})
