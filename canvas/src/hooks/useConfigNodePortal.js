/**
 * Shared portal workflow integration for image/video config nodes.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { updateNode, currentProjectId } from '@/stores/canvas'
import {
  runPortalWorkflow,
  cancelPortalWorkflow,
  uploadPortalImage,
  getPortalAppModeLabel,
} from '../api/portal'
import {
  buildDefaultParamValues,
  filterAppsByStudioMode,
  getExposedParams,
  isPromptParam,
  rememberPortalApp,
  resolveConnectedInputNodes,
  usePortalWorkflow,
} from './usePortalWorkflow'

const STUDIO_MODE_LABELS = {
  t2i: '文生图',
  i2i: '图生图',
  t2v: '文生视频',
  i2v: '图生视频',
}

export const PORTAL_MODEL_PREFIX = 'portal:'

export function toPortalModelKey(appId) {
  return `${PORTAL_MODEL_PREFIX}${appId}`
}

export function parsePortalModelKey(key) {
  const value = String(key || '')
  if (!value.startsWith(PORTAL_MODEL_PREFIX)) return null
  return value.slice(PORTAL_MODEL_PREFIX.length) || null
}

export function isPortalModelKey(key) {
  return String(key || '').startsWith(PORTAL_MODEL_PREFIX)
}

export function inferStudioModeFromLabel(label, fallback = 't2i') {
  const text = String(label || '')
  if (/图生视频|i2v/i.test(text)) return 'i2v'
  if (/文生视频|t2v/i.test(text)) return 't2v'
  if (/图生图|i2i/i.test(text)) return 'i2i'
  if (/文生图|t2i/i.test(text)) return 't2i'
  if (/生图配置|图生/.test(text)) return 'i2i'
  if (/视频/.test(text) && /图/.test(text)) return 'i2v'
  if (/视频/.test(text)) return 't2v'
  return fallback
}

export function useConfigNodePortal(props, {
  defaultStudioMode = 't2i',
  allowedModes = ['t2i', 'i2i'],
  nodes,
  edges,
}) {
  const { allApps, loadingApps, loadApps, loadManifest } = usePortalWorkflow()

  const localStudioMode = ref(props.data?.studioMode || inferStudioModeFromLabel(props.data?.label, defaultStudioMode))
  const localWorkflowId = ref(props.data?.workflowAppId || '')
  const localWorkflowParams = ref({ ...(props.data?.workflowParams || {}) })
  const currentManifest = ref(null)
  const activePromptId = ref(null)
  const activeOutputNodeId = ref(null)
  const abortController = ref(null)
  const cancelledByUser = ref(false)
  const portalLoading = ref(false)

  const studioModeOptions = computed(() =>
    allowedModes.map((mode) => ({
      label: STUDIO_MODE_LABELS[mode] || mode,
      key: mode,
    }))
  )

  const displayStudioMode = computed(() => STUDIO_MODE_LABELS[localStudioMode.value] || localStudioMode.value)

  const workflowOptions = computed(() =>
    filterAppsByStudioMode(allApps.value, localStudioMode.value).map((app) => ({
      label: `${app.name || app.id} · ${getPortalAppModeLabel(app.studio_modes, app)}`,
      key: app.id,
    }))
  )

  const portalModelOptions = computed(() => {
    const options = []
    for (const mode of allowedModes) {
      for (const app of filterAppsByStudioMode(allApps.value, mode)) {
        options.push({
          label: `[${STUDIO_MODE_LABELS[mode]}] ${app.name || app.id}`,
          key: toPortalModelKey(app.id),
          appId: app.id,
          studioMode: mode,
        })
      }
    }
    return options
  })

  const exposedParams = computed(() => getExposedParams(currentManifest.value))

  const displayWorkflowName = computed(() => {
    const app = allApps.value.find((item) => item.id === localWorkflowId.value)
    return app?.name || props.data?.workflowAppName || localWorkflowId.value || '选择工作流（可选）'
  })

  const hasPortalWorkflow = computed(() => !!localWorkflowId.value)

  const buildSelectOptions = (options) =>
    options.map((option) => ({
      label: String(option),
      key: option,
    }))

  const displayParamValue = (param) => {
    const value = localWorkflowParams.value[param.key]
    if (value === undefined || value === null || value === '') {
      return param.default ?? '请选择'
    }
    return String(value)
  }

  const applyManifest = async (appId, resetParams = false) => {
    if (!appId) {
      currentManifest.value = null
      return
    }
    const manifest = await loadManifest(appId)
    currentManifest.value = manifest
    if (resetParams || !Object.keys(localWorkflowParams.value).length) {
      localWorkflowParams.value = buildDefaultParamValues(manifest)
    }
  }

  const persistWorkflowState = (extra = {}) => {
    updateNode(props.id, {
      studioMode: localStudioMode.value,
      workflowAppId: localWorkflowId.value,
      workflowAppName: allApps.value.find((item) => item.id === localWorkflowId.value)?.name || props.data?.workflowAppName || '',
      workflowParams: { ...localWorkflowParams.value },
      ...extra,
    })
  }

  const handleStudioModeSelect = async (mode) => {
    localStudioMode.value = mode
    localWorkflowId.value = ''
    currentManifest.value = null
    localWorkflowParams.value = {}
    persistWorkflowState()
    const first = filterAppsByStudioMode(allApps.value, mode)[0]
    if (first?.id) {
      await handleWorkflowSelect(first.id)
    }
  }

  const handleWorkflowSelect = async (appId) => {
    localWorkflowId.value = appId || ''
    if (!appId) {
      currentManifest.value = null
      localWorkflowParams.value = {}
      persistWorkflowState({ model: props.data?.model || '' })
      return
    }
    rememberPortalApp(appId)
    await applyManifest(appId, true)
    persistWorkflowState({ model: toPortalModelKey(appId) })
  }

  const clearPortalSelection = () => {
    localWorkflowId.value = ''
    currentManifest.value = null
    localWorkflowParams.value = {}
    persistWorkflowState()
  }

  const selectFromModelKey = async (key) => {
    if (!isPortalModelKey(key)) {
      clearPortalSelection()
      return false
    }
    const appId = parsePortalModelKey(key)
    const option = portalModelOptions.value.find((item) => item.key === key)
    if (option?.studioMode) {
      localStudioMode.value = option.studioMode
    }
    await handleWorkflowSelect(appId)
    return true
  }

  const resolveInitialModelKey = () => {
    if (props.data?.workflowAppId) {
      return toPortalModelKey(props.data.workflowAppId)
    }
    if (isPortalModelKey(props.data?.model)) {
      return props.data.model
    }
    return props.data?.model || ''
  }

  const handleParamChange = (key, value) => {
    localWorkflowParams.value = {
      ...localWorkflowParams.value,
      [key]: value,
    }
    persistWorkflowState()
  }

  const getConnectedParamInputs = () => {
    const previews = resolveConnectedInputNodes(props.id, currentManifest.value, nodes.value, edges.value)
    const textByKey = {}
    const imagesByKey = {}
    for (const item of previews) {
      if (!item.filled) continue
      if (item.type === 'image') {
        imagesByKey[item.key] = item.previewImage
      } else {
        textByKey[item.key] = item.previewText
      }
    }
    return { textByKey, imagesByKey }
  }

  const buildRunParams = async (prompt, refImages = []) => {
    const runParams = { ...localWorkflowParams.value }
    const manifestParams = Array.isArray(currentManifest.value?.params) ? currentManifest.value.params : []
    const { textByKey, imagesByKey } = getConnectedParamInputs()

    for (const [key, content] of Object.entries(textByKey)) {
      if (content) runParams[key] = content
    }

    for (const [key, imageData] of Object.entries(imagesByKey)) {
      runParams[key] = await uploadPortalImage(imageData)
    }

    if (prompt) {
      for (const param of manifestParams) {
        if (!param?.key || textByKey[param.key]) continue
        if (param.type === 'text' || param.type === 'textarea' || isPromptParam(param)) {
          runParams[param.key] = prompt
        }
      }
    }

    if (refImages.length > 0) {
      const imageParams = manifestParams.filter((param) => param?.type === 'image')
      const unboundParams = imageParams.filter((param) => !imagesByKey[param.key])
      if (unboundParams.length > 0) {
        for (let i = 0; i < unboundParams.length; i++) {
          const source = refImages[i]
          if (!source) break
          runParams[unboundParams[i].key] = await uploadPortalImage(source)
        }
      }
    }

    return runParams
  }

  const buildVideoRunParams = async ({ prompt, first_frame_image, last_frame_image, images }) => {
    const runParams = { ...localWorkflowParams.value }
    const manifestParams = Array.isArray(currentManifest.value?.params) ? currentManifest.value.params : []
    const { textByKey, imagesByKey } = getConnectedParamInputs()

    for (const [key, content] of Object.entries(textByKey)) {
      if (content) runParams[key] = content
    }

    for (const [key, imageData] of Object.entries(imagesByKey)) {
      runParams[key] = await uploadPortalImage(imageData)
    }

    if (prompt) {
      for (const param of manifestParams) {
        if (!param?.key || textByKey[param.key]) continue
        if (param.type === 'text' || param.type === 'textarea' || isPromptParam(param)) {
          runParams[param.key] = prompt
        }
      }
    }

    const imageParams = manifestParams.filter((param) => param?.type === 'image')
    const unboundParams = imageParams.filter((param) => !imagesByKey[param.key])
    if (unboundParams.length > 0) {
      const imageSources = []
      if (first_frame_image) imageSources.push(first_frame_image)
      if (last_frame_image) imageSources.push(last_frame_image)
      imageSources.push(...images)
      for (let i = 0; i < unboundParams.length; i++) {
        const source = imageSources[i]
        if (!source) break
        runParams[unboundParams[i].key] = await uploadPortalImage(source)
      }
    }

    return runParams
  }

  const resolveResultUrl = (result, video = false) => {
    const media = Array.isArray(result?.media) ? result.media : []
    if (video) {
      const videoItem = media.find((item) => item?.kind === 'video') || media[0]
      return videoItem?.view_url || videoItem?.download_url || ''
    }
    const first = media.find((item) => item?.view_url || item?.download_url)
    return first?.view_url || first?.download_url || ''
  }

  const resetOutputNodeAfterCancel = () => {
    const nodeId = activeOutputNodeId.value
    if (!nodeId) return
    updateNode(nodeId, {
      loading: false,
      error: '任务已取消',
      label: '已取消',
      updatedAt: Date.now(),
    })
  }

  const handlePortalCancel = async () => {
    if (!portalLoading.value) return
    cancelledByUser.value = true
    abortController.value?.abort()
    const promptId = activePromptId.value
    if (promptId) {
      try {
        await cancelPortalWorkflow(promptId)
      } catch (err) {
        console.warn('[ConfigNodePortal] cancel failed:', err)
      }
    }
    resetOutputNodeAfterCancel()
    portalLoading.value = false
    activePromptId.value = null
    activeOutputNodeId.value = null
    abortController.value = null
    window.$message?.info('任务已取消')
  }

  const runPortal = async (buildParams, prompt, outputNodeId, { timeoutSec = 600, video = false } = {}) => {
    if (!localWorkflowId.value) {
      throw new Error('请先选择工作流')
    }

    cancelledByUser.value = false
    portalLoading.value = true
    abortController.value = new AbortController()
    activePromptId.value = null
    activeOutputNodeId.value = outputNodeId

    try {
      const runParams = await buildParams()
      const result = await runPortalWorkflow(localWorkflowId.value, runParams, {
        prompt,
        timeoutSec,
        signal: abortController.value.signal,
        isCancelled: () => cancelledByUser.value,
        canvasId: currentProjectId.value || '',
        source: 'canvas',
        onPromptQueued: (promptId) => {
          activePromptId.value = promptId
        },
      })
      return resolveResultUrl(result, video)
    } catch (err) {
      if (err?.name === 'AbortError' || cancelledByUser.value) {
        throw err
      }
      throw err
    } finally {
      portalLoading.value = false
      activePromptId.value = null
      activeOutputNodeId.value = null
      abortController.value = null
    }
  }

  onMounted(async () => {
    await loadApps()
    const initialKey = resolveInitialModelKey()
    if (isPortalModelKey(initialKey)) {
      await selectFromModelKey(initialKey)
    } else if (localWorkflowId.value) {
      await applyManifest(localWorkflowId.value)
    }
  })

  watch(() => props.data?.workflowAppId, async (newAppId) => {
    if (newAppId && newAppId !== localWorkflowId.value) {
      localWorkflowId.value = newAppId
      await applyManifest(newAppId)
    }
  })

  watch(() => props.data?.studioMode, (mode) => {
    if (mode && mode !== localStudioMode.value) {
      localStudioMode.value = mode
    }
  })

  watch(() => props.data?.workflowParams, (nextParams) => {
    if (nextParams && typeof nextParams === 'object') {
      localWorkflowParams.value = { ...nextParams }
    }
  }, { deep: true })

  return {
    allApps,
    loadingApps,
    localStudioMode,
    localWorkflowId,
    localWorkflowParams,
    currentManifest,
    portalLoading,
    portalModelOptions,
    studioModeOptions,
    displayStudioMode,
    workflowOptions,
    exposedParams,
    displayWorkflowName,
    hasPortalWorkflow,
    buildSelectOptions,
    displayParamValue,
    handleStudioModeSelect,
    handleWorkflowSelect,
    handleParamChange,
    selectFromModelKey,
    clearPortalSelection,
    resolveInitialModelKey,
    buildRunParams,
    buildVideoRunParams,
    runPortal,
    handlePortalCancel,
  }
}
