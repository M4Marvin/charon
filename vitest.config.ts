import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig((env) => {
  const base = typeof viteConfig === 'function' ? viteConfig(env) : viteConfig
  const { plugins: _, ...rest } = base

  return defineConfig({
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
})
