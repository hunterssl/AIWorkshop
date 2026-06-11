import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const canvasRoot = __dirname
const canvasSrcRoot = path.join(canvasRoot, 'src')
const pkgJson = path.join(canvasRoot, 'package.json')
const localRequire = createRequire(pkgJson)

if (!fs.existsSync(path.join(canvasSrcRoot, 'main.js'))) {
  throw new Error(`找不到画布源码: ${canvasSrcRoot}`)
}

const tailwindcss = localRequire('tailwindcss')
const autoprefixer = localRequire('autoprefixer')
const tailwindConfig = path.join(canvasRoot, 'tailwind.config.js')

function canvasPathRedirectPlugin() {
  const redirectScript = `<script>(function(){var m='/rh/canvas2',p=location.pathname,i=p.indexOf(m);if(i>0){location.replace(m+p.slice(i+m.length)+location.search+location.hash)}})();</script>`
  return {
    name: 'canvas-path-redirect',
    transformIndexHtml(html) {
      const authBridge = '<script src="/rh/studio/studio-auth-bridge.js"></script>'
      return html
        .replace('<head>', `<head>\n    ${redirectScript}`)
        .replace('</title>', `</title>\n    ${authBridge}`)
    },
  }
}

/** ComfyUI blocks requests when Origin (localhost:5173) != Host (127.0.0.1:8188). */
function comfyUiProxy() {
  return {
    target: 'http://127.0.0.1:8188',
    changeOrigin: true,
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin')
        proxyReq.removeHeader('referer')
      })
    },
  }
}

export default defineConfig({
  root: canvasRoot,
  cacheDir: path.join(canvasRoot, 'node_modules/.vite'),
  plugins: [canvasPathRedirectPlugin(), vue()],
  resolve: {
    alias: [{ find: '@', replacement: canvasSrcRoot }],
  },
  css: {
    postcss: {
      plugins: [tailwindcss({ config: tailwindConfig }), autoprefixer()],
    },
  },
  base: '/rh/canvas2/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/rh/api': comfyUiProxy(),
      '/rh/virtual-images': comfyUiProxy(),
      '/rh/studio': comfyUiProxy(),
      '/rh/portal/covers': comfyUiProxy(),
      '/upload': comfyUiProxy(),
      '/view': comfyUiProxy(),
      '/interrupt': comfyUiProxy(),
      '/api/interrupt': comfyUiProxy(),
      '/queue': comfyUiProxy(),
      '/rh/ws': {
        target: 'ws://127.0.0.1:8188',
        ws: true,
      },
    },
  },
  build: {
    outDir: path.join(canvasRoot, 'dist'),
    emptyOutDir: true,
  },
})
