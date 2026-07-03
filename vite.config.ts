import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'use-sync-external-store/shim/with-selector': 'use-sync-external-store/shim/with-selector.js',
      'use-sync-external-store/shim': 'use-sync-external-store/shim/index.js',
    },
  },
  optimizeDeps: {
    include: [
      'use-sync-external-store/shim/with-selector',
      'use-sync-external-store/shim',
    ],
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
