/**
 * Portal workflow hook | 创作工坊工作流 Hook
 */
import { ref } from 'vue'
import { getPortalApp, listPortalApps } from '../api/portal'

export const PROMPT_PARAM_KEYS = new Set([
  'prompt',
  'text',
  'positive',
  'positive_prompt',
  'negative',
  'negative_prompt',
])

export function isPromptParam(param) {
  if (!param || typeof param !== 'object') return false
  const key = String(param.key || '').toLowerCase()
  if (PROMPT_PARAM_KEYS.has(key)) return true
  const label = String(param.label || '')
  return /提示词|prompt/i.test(label) || /prompt|positive|negative/i.test(key)
}

export function isInputParam(param) {
  if (!param || typeof param !== 'object') return false
  if (param.type === 'image') return true
  if (param.type === 'text' || param.type === 'textarea') return true
  return isPromptParam(param)
}

export function getInputParams(manifest) {
  const params = Array.isArray(manifest?.params) ? manifest.params : []
  return params.filter((param) => isInputParam(param))
}

export function getExposedParams(manifest) {
  const params = Array.isArray(manifest?.params) ? manifest.params : []
  return params.filter((param) => !isInputParam(param))
}

export function buildDefaultParamValues(manifest) {
  const values = {}
  for (const param of getExposedParams(manifest)) {
    if (param?.key) {
      values[param.key] = param.default ?? ''
    }
  }
  return values
}

export function resolvePortalImageDefault(param) {
  const value = param?.default
  if (value == null || value === '') return ''
  const text = String(value)
  if (/^(https?:|data:|\/|blob:)/i.test(text)) return text
  const query = new URLSearchParams({
    filename: text,
    subfolder: String(param?.subfolder || ''),
    type: String(param?.imageType || param?.folder || 'input'),
  })
  return `/view?${query.toString()}`
}

export function buildPortalInputNodeSpec(param, position) {
  if (param?.type === 'image') {
    return {
      type: 'image',
      position,
      data: {
        url: resolvePortalImageDefault(param),
        label: param.label || '图片输入',
        portalParamKey: param.key,
      },
    }
  }
  return {
    type: 'text',
    position,
    data: {
      content: param?.default != null ? String(param.default) : '',
      label: param.label || '文本输入',
      portalParamKey: param.key,
    },
  }
}

export function resolveConnectedInputNodes(configNodeId, manifest, nodeList, edgeList) {
  const inputParams = getInputParams(manifest)
  if (!inputParams.length) return []

  const connectedEdges = edgeList.filter((edge) => edge.target === configNodeId)
  const textParams = inputParams.filter((param) => param.type !== 'image')
  const imageParams = inputParams.filter((param) => param.type === 'image')
  const bindings = new Map()

  for (const edge of connectedEdges) {
    const sourceNode = nodeList.find((node) => node.id === edge.source)
    if (!sourceNode) continue
    const paramKey = sourceNode.data?.portalParamKey || edge.data?.portalParamKey
    if (!paramKey) continue
    const param = inputParams.find((item) => item.key === paramKey)
    if (param) bindings.set(paramKey, { param, sourceNode })
  }

  const unboundTextNodes = []
  const unboundImageNodes = []
  for (const edge of connectedEdges) {
    const sourceNode = nodeList.find((node) => node.id === edge.source)
    if (!sourceNode) continue
    if (sourceNode.data?.portalParamKey || edge.data?.portalParamKey) continue
    if (sourceNode.type === 'text' || sourceNode.type === 'llmConfig') {
      unboundTextNodes.push(sourceNode)
    } else if (sourceNode.type === 'image') {
      unboundImageNodes.push(sourceNode)
    }
  }

  textParams.filter((param) => !bindings.has(param.key)).forEach((param, index) => {
    const sourceNode = unboundTextNodes[index]
    if (sourceNode) bindings.set(param.key, { param, sourceNode })
  })
  imageParams.filter((param) => !bindings.has(param.key)).forEach((param, index) => {
    const sourceNode = unboundImageNodes[index]
    if (sourceNode) bindings.set(param.key, { param, sourceNode })
  })

  return inputParams.map((param) => {
    const binding = bindings.get(param.key)
    const sourceNode = binding?.sourceNode
    let previewText = ''
    let previewImage = ''

    if (param.type === 'image') {
      previewImage = sourceNode?.data?.base64 || sourceNode?.data?.url || ''
    } else if (sourceNode?.type === 'llmConfig') {
      previewText = sourceNode.data?.outputContent || ''
    } else {
      previewText = sourceNode?.data?.content || ''
    }

    const filled = param.type === 'image'
      ? !!previewImage
      : !!String(previewText).trim()

    return {
      key: param.key,
      label: param.label || param.key,
      type: param.type,
      linked: !!sourceNode,
      filled,
      previewText,
      previewImage,
    }
  })
}

export function inferStudioModes(app) {
  const modes = Array.isArray(app?.studio_modes) ? app.studio_modes.filter(Boolean) : []
  if (modes.length) return modes

  const params = Array.isArray(app?.params) ? app.params : []
  const tags = Array.isArray(app?.tags) ? app.tags : []
  const hasImage = params.some((param) => param?.type === 'image')
  const hasPrompt = params.some((param) => isPromptParam(param))

  if (tags.includes('video')) {
    return hasImage ? ['i2v', 't2v'] : ['t2v']
  }
  if (hasImage && !hasPrompt) return ['t2i', 'i2i']
  if (hasImage) return ['t2i', 'i2i']
  if (hasPrompt) return ['t2i']
  return ['t2i']
}

export function filterAppsByStudioMode(apps, mode) {
  if (!Array.isArray(apps) || !mode) return []
  return apps.filter((app) => {
    const modes = inferStudioModes(app)
    if (!modes.length) return true
    return modes.includes(mode)
  })
}

export const LAST_PORTAL_APP_STORAGE_KEY = 'rh_canvas_last_portal_app_id'

export function rememberPortalApp(appId) {
  if (!appId) return
  try {
    localStorage.setItem(LAST_PORTAL_APP_STORAGE_KEY, String(appId))
  } catch {
    // Ignore storage failures.
  }
}

export async function resolveDefaultPortalApp() {
  const apps = await listPortalApps({ studioOnly: true })
  if (!apps.length) return null
  try {
    const lastId = localStorage.getItem(LAST_PORTAL_APP_STORAGE_KEY)
    if (lastId) {
      const found = apps.find((item) => item.id === lastId)
      if (found) return found
    }
  } catch {
    // Ignore storage failures.
  }
  return apps[0]
}

export function isVideoApp(appOrManifest) {
  const modes = inferStudioModes(appOrManifest)
  return modes.includes('i2v') || modes.includes('t2v')
}

export function usePortalWorkflow() {
  const allApps = ref([])
  const loadingApps = ref(false)
  const manifestCache = ref({})

  const loadApps = async () => {
    loadingApps.value = true
    try {
      allApps.value = await listPortalApps({ studioOnly: true })
    } finally {
      loadingApps.value = false
    }
  }

  const loadManifest = async (appId) => {
    if (!appId) return null
    if (manifestCache.value[appId]) {
      return manifestCache.value[appId]
    }
    const manifest = await getPortalApp(appId)
    manifestCache.value = { ...manifestCache.value, [appId]: manifest }
    return manifest
  }

  return {
    allApps,
    loadingApps,
    manifestCache,
    loadApps,
    loadManifest,
    filterAppsByStudioMode,
  }
}
