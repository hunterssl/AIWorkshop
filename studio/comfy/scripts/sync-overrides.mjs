/**
 * 从 Canvas2 同步可共享文件到 overrides，并保留 ComfyUI 专用补丁。
 *
 * 用法: npm run sync:overrides
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CANVAS_SRC = path.resolve(ROOT, '../../canvas/src')
const OVERRIDE_SRC = path.resolve(ROOT, 'overrides/src')

const COMFYUI_LOCAL_BLOCK = `  comfyui_local: {
    label: '本地 ComfyUI',
    defaultBaseUrl: '',
    endpoints: {
      chat: '/v1/chat/completions',
      image: '/rh/api/studio/run-local',
      video: '/rh/api/studio/run-local',
      videoQuery: '/rh/api/studio/result',
    },
    requestAdapter: {
      chat: (params) => params,
      image: (params) => params,
      video: (params) => params,
    },
    responseAdapter: {
      chat: (data) => data,
      image: (data) => data,
      video: (data) => data,
    },
  },
`

/** 与 Canvas2 完全一致、可直接覆盖的文件（不含 ComfyUI 定制） */
const DIRECT_SYNC = []

/** 从 Canvas2 复制后保留 override 里 ComfyUI 改动的文件说明 */
const COMFYUI_ONLY = [
  'api/portal.js',
  'views/Canvas.vue',
  'router/index.js',
  'components/PortalWorkflowPanel.vue',
  'components/nodes/PortalComfyConfigNode.vue',
  'hooks/usePortalWorkflow.js',
  'components/AppHeader.vue', // 去掉 GitHub 链接
  'config/providers.js', // 额外 comfyui_local 渠道
]

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function syncProviders() {
  const src = path.join(CANVAS_SRC, 'config/providers.js')
  const dest = path.join(OVERRIDE_SRC, 'config/providers.js')
  if (!fs.existsSync(src)) {
    console.warn('[skip] providers.js not found in Canvas2')
    return
  }
  let content = fs.readFileSync(src, 'utf8')
  if (!content.includes('comfyui_local:')) {
    content = content.replace('export const PROVIDERS = {', `export const PROVIDERS = {\n${COMFYUI_LOCAL_BLOCK}`)
  }
  ensureDir(dest)
  fs.writeFileSync(dest, content)
  console.log('[sync] config/providers.js (+ comfyui_local)')
}

function main() {
  if (!fs.existsSync(CANVAS_SRC)) {
    console.error(`Canvas2 源码不存在: ${CANVAS_SRC}`)
    process.exit(1)
  }

  for (const rel of DIRECT_SYNC) {
    const src = path.join(CANVAS_SRC, rel)
    const dest = path.join(OVERRIDE_SRC, rel)
    if (!fs.existsSync(src)) {
      console.warn(`[skip] ${rel}`)
      continue
    }
    ensureDir(dest)
    fs.copyFileSync(src, dest)
    console.log(`[sync] ${rel}`)
  }

  syncProviders()

  console.log('\nComfyUI 专用文件需手动合并 Canvas2 改动:')
  COMFYUI_ONLY.forEach((f) => console.log(`  - overrides/src/${f}`))
  console.log('\n合并完成后运行: npm run build')
}

main()
