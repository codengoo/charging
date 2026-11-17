import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Logic thuần (không DOM). Luôn tối đa 2 worker — chạy full core làm treo máy.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
    maxWorkers: 2,
    minWorkers: 1,
  },
})
