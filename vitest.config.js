import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.js'],
        },
      },
      {
        extends: true,
        test: {
          name: 'components',
          environment: 'jsdom',
          // jsdom only exposes localStorage for non-opaque origins
          environmentOptions: { jsdom: { url: 'http://localhost:3000' } },
          setupFiles: ['./vitest.setup.jsdom.js'],
          include: ['src/**/*.test.jsx'],
        },
      },
    ],
  },
})
