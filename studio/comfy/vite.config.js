import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// canvas 源码目录（相对于 studio/comfy/）
const canvasRoot = path.resolve(__dirname, '../../canvas')
const canvasSrcRoot = path.join(canvasRoot, 'src')
const overridesRoot = path.resolve(__dirname, 'overrides')
const comfyPkgJson = path.join(__dirname, 'package.json')
const comfyNodeModules = path.join(__dirname, 'node_modules')
const localRequire = createRequire(comfyPkgJson)

function requireModule(name) {
  try {
    return localRequire(name)
  } catch {
    if (fs.existsSync(path.join(canvasRoot, 'package.json'))) {
      try {
        return createRequire(path.join(canvasRoot, 'package.json'))(name)
      } catch {
        /* fall through */
      }
    }
    throw new Error(
      `缺少依赖「${name}」。请在 studio/comfy 目录运行: npm install`
    )
  }
}

if (!fs.existsSync(canvasRoot) || !fs.existsSync(path.join(canvasRoot, 'src'))) {
  throw new Error(
    `找不到 Canvas2 源码目录: ${canvasRoot}\n` +
    '请确认 Canvas2/Canvas 与 ComfyUI 在同一上级目录（例如 E:\\xiazai\\Canvas2\\Canvas）。'
  )
}

const tailwindcss = requireModule('tailwindcss')
const autoprefixer = requireModule('autoprefixer')
const tailwindConfig = path.resolve(__dirname, 'tailwind.config.js')

const EXTENSIONS = ['', '.vue', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.json']

function walkOverrideMap(dir, map = new Map()) {
  if (!fs.existsSync(dir)) return map
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkOverrideMap(fullPath, map)
      continue
    }
    const relative = path.relative(overridesRoot, fullPath).replace(/\\/g, '/')
    map.set(relative, fullPath)
  }
  return map
}

const overrideMap = walkOverrideMap(overridesRoot)
const overrideTargets = new Map()

/** 把 overrides 里「Canvas2 不存在」的文件映射为 @/ alias */
function buildOverrideAliases() {
  const aliases = []
  for (const [rel, overridePath] of overrideMap.entries()) {
    if (!rel.startsWith('src/')) continue
    const canvasPath = path.join(canvasRoot, rel)
    if (fs.existsSync(canvasPath)) continue
    aliases.push({
      find: `@/${rel.slice(4)}`,
      replacement: overridePath,
    })
  }
  return aliases
}

const overrideAliases = buildOverrideAliases()

const REQUIRED_OVERRIDES = [
  'src/views/Canvas.vue',
  'src/components/nodes/PortalComfyConfigNode.vue',
  'src/components/WorkflowPanel.vue',
  'src/config/models.js',
]

for (const rel of REQUIRED_OVERRIDES) {
  if (!overrideMap.has(rel)) {
    console.warn(`[canvas-overrides] 缺少关键文件: overrides/${rel}`)
  }
}

function normalizeKey(filePath) {
  return path.normalize(filePath)
}

function resolveWithExtensions(basePath) {
  for (const ext of EXTENSIONS) {
    const candidate = ext ? `${basePath}${ext}` : basePath
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }
  return null
}

function getCanvasRelative(filePath) {
  return path.relative(canvasRoot, filePath).replace(/\\/g, '/')
}

function resolveCanvasTarget(resolvedBase) {
  const existing = resolveWithExtensions(resolvedBase)
  if (existing) return existing

  if (fs.existsSync(resolvedBase) && fs.statSync(resolvedBase).isDirectory()) {
    for (const ext of EXTENSIONS.filter(Boolean)) {
      const indexCandidate = path.join(resolvedBase, `index${ext}`)
      if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
        return indexCandidate
      }
    }
  }

  const candidates = resolvedBase.includes('.')
    ? [resolvedBase]
    : EXTENSIONS.filter(Boolean).map((ext) => `${resolvedBase}${ext}`)

  for (const candidate of candidates) {
    if (overrideMap.has(getCanvasRelative(candidate))) {
      return candidate
    }
  }

  return null
}

function canvasPathRedirectPlugin() {
  const redirectScript = `<script>(function(){var m='/rh/canvas2',p=location.pathname,i=p.indexOf(m);if(i>0){location.replace(m+p.slice(i+m.length)+location.search+location.hash)}})();</script>`
  return {
    name: 'canvas-path-redirect',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    ${redirectScript}`)
    },
  }
}

function canvasOverridePlugin() {
  return {
    name: 'canvas-overrides',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || source.includes('\0')) return null

      let resolvedBase = null
      if (source.startsWith('@/')) {
        resolvedBase = path.join(canvasSrcRoot, source.slice(2))
      } else if (source.startsWith('.')) {
        resolvedBase = path.normalize(path.join(path.dirname(importer), source))
      } else {
        return null
      }

      const resolved = resolveCanvasTarget(resolvedBase)
      if (!resolved || !normalizeKey(resolved).startsWith(normalizeKey(canvasRoot))) return null

      const overridePath = overrideMap.get(getCanvasRelative(resolved))
      if (!overridePath) return null

      overrideTargets.set(normalizeKey(resolved), overridePath)
      return resolved
    },
    load(id) {
      const normalized = normalizeKey(id)
      if (!normalized.startsWith(normalizeKey(canvasRoot))) return null

      const overridePath =
        overrideTargets.get(normalized) ||
        overrideMap.get(getCanvasRelative(normalized))
      if (!overridePath) return null
      return fs.readFileSync(overridePath, 'utf-8')
    },
  }
}

/** 内网机 canvas 未 npm install 时，从 studio/comfy/node_modules 解析依赖 */
function comfyNodeModulesFallback() {
  return {
    name: 'comfy-node-modules-fallback',
    enforce: 'pre',
    async resolveId(source) {
      if (
        !source ||
        source.startsWith('.') ||
        source.startsWith('/') ||
        source.startsWith('\0') ||
        source.startsWith('@/')
      ) {
        return null
      }
      if (!fs.existsSync(comfyNodeModules)) return null
      return this.resolve(source, comfyPkgJson, { skipSelf: true })
    },
  }
}

export default defineConfig({
  root: canvasRoot,
  cacheDir: path.join(__dirname, 'node_modules/.vite'),
  plugins: [comfyNodeModulesFallback(), canvasPathRedirectPlugin(), canvasOverridePlugin(), vue()],
  resolve: {
    alias: [
      ...overrideAliases,
      {
        find: path.join(canvasSrcRoot, 'router/index.js'),
        replacement: path.join(overridesRoot, 'src/router/index.js'),
      },
      { find: '@', replacement: canvasSrcRoot },
    ],
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: tailwindConfig }),
        autoprefixer(),
      ],
    },
  },
  base: '/rh/canvas2/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/rh/api': {
        target: 'http://127.0.0.1:8188',
        changeOrigin: true,
      },
      '/rh/ws': {
        target: 'ws://127.0.0.1:8188',
        ws: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true,
  },
})
