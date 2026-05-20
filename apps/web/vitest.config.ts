import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // Forzar root al directorio del config para que vitest NUNCA escanee
  // worktrees temporales de agentes Claude (.claude/worktrees/...) que
  // viven por encima en el repo y romperian el resolve de "@/..." porque
  // no tienen tsconfig propio. Funciona aunque se invoque desde la raiz
  // del monorepo.
  root: __dirname,
  test: {
    environment: 'node',
    globals: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      '**/.claude/worktrees/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
