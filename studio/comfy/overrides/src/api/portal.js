/**
 * Portal / Creative Studio workflow API | 创作工坊工作流 API
 */

const STUDIO_MODE_KEYS = new Set(['t2i', 't2v', 'i2i', 'i2v'])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJsonResponse(res) {
  const text = await res.text()
  if (!text) {
    if (res.status === 401) throw new Error('请先登录后再运行任务（请先在创作工坊登录）')
    if (res.status === 403) throw new Error('请求被 ComfyUI 拒绝，请用 http://127.0.0.1:8188/rh/canvas2 访问，或重启 npm run dev')
    throw new Error(`服务器无响应 (${res.status})，请确认 ComfyUI 已在 8188 端口运行`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`服务器响应异常 (${res.status})`)
  }
}

export function isStudioPublishedApp(app) {
  const modes = Array.isArray(app?.studio_modes) ? app.studio_modes : []
  return modes.some((mode) => STUDIO_MODE_KEYS.has(mode))
}

export async function listPortalApps({ studioOnly = false } = {}) {
  const res = await fetch('/rh/api/apps', { cache: 'no-store' })
  const data = await readJsonResponse(res)
  if (!res.ok) {
    throw new Error(data?.error || '加载工作流列表失败')
  }
  const apps = Array.isArray(data?.apps) ? data.apps : []
  return studioOnly ? apps.filter(isStudioPublishedApp) : apps
}

export async function getPortalApp(appId) {
  const res = await fetch(`/rh/api/apps/${encodeURIComponent(appId)}`, { cache: 'no-store' })
  const data = await readJsonResponse(res)
  if (!res.ok) {
    throw new Error(data?.error || '加载工作流详情失败')
  }
  return data
}

class PortalWorkflowAbortError extends Error {
  constructor(message = '任务已取消') {
    super(message)
    this.name = 'AbortError'
  }
}

async function postInterruptRequest(promptId) {
  const payload = promptId ? { prompt_id: promptId } : {}
  const endpoints = ['/interrupt', '/api/interrupt']
  let lastError = null
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) return
    } catch (err) {
      lastError = err
    }
  }
  if (lastError) throw lastError
}

async function deletePendingQueueTask(promptId) {
  const res = await fetch('/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delete: [promptId] }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || '从队列移除任务失败')
  }
}

export async function cancelPortalWorkflow(promptId) {
  const id = String(promptId || '').trim()
  if (!id) return

  try {
    await postInterruptRequest(id)
  } catch {
    // 任务可能尚未开始执行，忽略中断失败
  }

  try {
    await deletePendingQueueTask(id)
  } catch {
    // 任务可能已在执行或已完成，忽略队列删除失败
  }

  try {
    await fetch('/rh/api/studio/task/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_id: id }),
    })
  } catch {
    // 运行中任务会返回 409，忽略
  }
}

export async function runPortalWorkflow(appId, params = {}, options = {}) {
  const timeoutSec = options.timeoutSec || 600
  const res = await fetch('/rh/api/studio/run-local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      params,
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      wait: false,
      timeout_sec: timeoutSec,
      client_id: options.clientId || 'huobao-canvas',
      source: options.source || 'canvas',
      canvas_id: options.canvasId || '',
      title: options.prompt || options.title || '',
    }),
    signal: options.signal,
  })
  const data = await readJsonResponse(res)
  if (!res.ok) {
    throw new Error(data?.error || data?.message || '工作流执行失败')
  }

  const promptId = data?.prompt_id
  if (!promptId) {
    throw new Error('未获取到任务 ID')
  }

  if (typeof options.onPromptQueued === 'function') {
    options.onPromptQueued(promptId)
  }

  return pollPortalResult(promptId, timeoutSec, options)
}

export async function pollPortalResult(promptId, timeoutSec = 600, options = {}) {
  const deadline = Date.now() + Math.max(timeoutSec, 1) * 1000
  while (Date.now() < deadline) {
    if (options.signal?.aborted || options.isCancelled?.()) {
      throw new PortalWorkflowAbortError()
    }

    const res = await fetch(`/rh/api/studio/result?prompt_id=${encodeURIComponent(promptId)}`, {
      cache: 'no-store',
      signal: options.signal,
    })
    const data = await readJsonResponse(res)

    if (options.signal?.aborted || options.isCancelled?.()) {
      throw new PortalWorkflowAbortError()
    }

    if (data?.completed) {
      const status = String(data?.status || '').toLowerCase()
      if (status === 'error' || status === 'failed') {
        throw new Error(data?.message || '工作流执行失败')
      }
      return { ...data, prompt_id: promptId }
    }

    if (data?.status === 'not_found') {
      await sleep(1500)
      continue
    }

    await sleep(2000)
  }
  throw new Error('工作流执行超时，任务可能仍在后台运行')
}

export async function uploadPortalImage(source) {
  let blob
  if (typeof source !== 'string' || !source) {
    throw new Error('参考图无效')
  }
  if (source.startsWith('data:')) {
    const response = await fetch(source)
    blob = await response.blob()
  } else {
    const response = await fetch(source, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error('读取参考图失败')
    }
    blob = await response.blob()
  }
  const formData = new FormData()
  formData.append('image', blob, 'reference.png')
  const response = await fetch('/upload/image', {
    method: 'POST',
    body: formData,
  })
  const data = await readJsonResponse(response)
  if (!response.ok) {
    throw new Error(data?.error || '参考图上传失败')
  }
  return data?.name || data?.filename || ''
}

export function resolvePortalAppNodeType(studioModes = []) {
  const modes = Array.isArray(studioModes) ? studioModes : []
  if (modes.includes('i2v') || modes.includes('t2v')) {
    return {
      configType: 'videoConfig',
      label: modes.includes('i2v') ? '图生视频' : '文生视频',
      workflowMode: modes.includes('i2v') ? 'i2v' : 't2v',
    }
  }
  return {
    configType: 'imageConfig',
    label: modes.includes('i2i') ? '图生图' : '文生图',
    workflowMode: modes.includes('i2i') ? 'i2i' : 't2i',
  }
}

export function getPortalAppModeLabel(studioModes = [], app = null) {
  let modes = Array.isArray(studioModes) ? studioModes : []
  if (!modes.length && app && typeof app === 'object') {
    const params = Array.isArray(app.params) ? app.params : []
    const hasImage = params.some((param) => param?.type === 'image')
    const tags = Array.isArray(app.tags) ? app.tags : []
    if (tags.includes('video')) {
      modes = hasImage ? ['i2v'] : ['t2v']
    } else if (hasImage) {
      modes = ['t2i']
    }
  }
  if (modes.includes('t2i')) return '文生图'
  if (modes.includes('i2i')) return '图生图'
  if (modes.includes('t2v')) return '文生视频'
  if (modes.includes('i2v')) return '图生视频'
  return '工作流'
}
