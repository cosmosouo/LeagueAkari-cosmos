import yaml from '@modyfi/vite-plugin-yaml'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(__dirname, 'src/mobile'),
  base: '/',
  plugins: [yaml(), vue({})],
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  build: {
    outDir: resolve(__dirname, 'out/mobile'),
    emptyOutDir: true,
    target: ['es2022', 'safari16'],
    sourcemap: false
  }
})
