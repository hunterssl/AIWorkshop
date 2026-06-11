<template>
  <!-- Image config node wrapper | 文生图配置节点包裹层 -->
  <div class="portal-comfy-config-node-wrapper" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <div
      class="portal-comfy-config-node bg-[var(--bg-secondary)] rounded-xl border min-w-[300px] transition-all duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'">
      <!-- Header | 头部 -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <span
          v-if="!isEditingLabel"
          @dblclick="startEditLabel"
          class="text-sm font-medium text-[var(--text-secondary)] cursor-text hover:bg-[var(--bg-tertiary)] px-1 rounded transition-colors"
          title="双击编辑名称"
        >{{ data.label }}</span>
        <input
          v-else
          ref="labelInputRef"
          v-model="editingLabelValue"
          @blur="finishEditLabel"
          @keydown.enter="finishEditLabel"
          @keydown.escape="cancelEditLabel"
          class="text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1 rounded outline-none border border-blue-500"
        />
        <div class="flex items-center gap-1">
          <button @click="handleDuplicate" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors" title="复制节点">
            <n-icon :size="14">
              <CopyOutline />
            </n-icon>
          </button>
          <button @click="handleDelete" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors" title="删除节点">
            <n-icon :size="14">
              <TrashOutline />
            </n-icon>
          </button>
        </div>
      </div>

      <!-- Config options | 配置选项 -->
      <div class="p-3 space-y-3">
        <!-- Workflow selector | 工作流选择 -->
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs text-[var(--text-secondary)] shrink-0">工作流</span>
          <n-dropdown :options="workflowOptions" @select="handleWorkflowSelect" trigger="click">
            <button class="flex items-center gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)] max-w-[180px] truncate">
              {{ displayWorkflowName }}
              <n-icon :size="12"><ChevronDownOutline /></n-icon>
            </button>
          </n-dropdown>
        </div>

        <!-- Exposed params from Creative Studio | 创作工坊暴露参数 -->
        <div v-for="param in exposedParams" :key="param.key" class="flex items-center justify-between gap-3">
          <span class="text-xs text-[var(--text-secondary)] shrink-0">{{ param.label || param.key }}</span>

          <n-dropdown
            v-if="param.type === 'select' && Array.isArray(param.options) && param.options.length"
            :options="buildSelectOptions(param.options)"
            @select="(value) => handleParamChange(param.key, value)"
            trigger="click"
          >
            <button class="flex items-center gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)] max-w-[180px] truncate">
              {{ displayParamValue(param) }}
              <n-icon :size="12"><ChevronForwardOutline /></n-icon>
            </button>
          </n-dropdown>

          <label v-else-if="param.type === 'toggle'" class="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              class="accent-[var(--accent-color)]"
              :checked="!!localWorkflowParams[param.key]"
              @change="handleParamChange(param.key, $event.target.checked)"
            />
            <span class="text-sm text-[var(--text-primary)]">{{ localWorkflowParams[param.key] ? '开启' : '关闭' }}</span>
          </label>

          <input
            v-else-if="param.type === 'number'"
            type="number"
            class="w-[120px] px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            :value="localWorkflowParams[param.key]"
            @change="handleParamChange(param.key, Number($event.target.value))"
          />

          <input
            v-else
            type="text"
            class="w-[120px] px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            :value="localWorkflowParams[param.key]"
            @change="handleParamChange(param.key, $event.target.value)"
          />
        </div>

        <div v-if="loadingApps" class="text-xs text-[var(--text-tertiary)]">正在加载创作工坊工作流...</div>
        <div v-else-if="!workflowOptions.length" class="text-xs text-[var(--text-tertiary)]">
          暂无创作工坊工作流，请先在 Portal 发布应用
        </div>

        <!-- Connected input previews | 已连接输入预览 -->
        <div
          v-if="inputParamPreviews.length"
          class="space-y-2 py-1 border-t border-[var(--border-color)]"
        >
          <div
            v-for="item in inputParamPreviews"
            :key="item.key"
            class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/60 px-2.5 py-2"
          >
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span class="text-xs font-medium text-[var(--text-secondary)]">{{ item.label }}</span>
              <span
                class="text-[10px] px-1.5 py-0.5 rounded-full"
                :class="item.filled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : (item.linked ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800')"
              >
                {{ item.filled ? '已填写' : (item.linked ? '待填写' : '未连接') }}
              </span>
            </div>
            <div v-if="item.type === 'image' && item.previewImage" class="rounded-md overflow-hidden bg-black/20">
              <img :src="item.previewImage" :alt="item.label" class="w-full max-h-24 object-contain" />
            </div>
            <div
              v-else-if="item.type !== 'image' && item.previewText"
              class="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words max-h-16 overflow-y-auto"
            >
              {{ item.previewText }}
            </div>
            <div v-else class="text-xs text-[var(--text-tertiary)]">
              {{ item.linked ? '请在左侧输入节点填写内容' : '请连接对应的输入节点' }}
            </div>
          </div>
        </div>

        <div
          v-else
          class="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)] py-1 border-t border-[var(--border-color)]"
        >
          <span class="px-2 py-0.5 rounded-full"
            :class="connectedPrompts.length > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            提示词 {{ connectedPrompts.length > 0 ? `${connectedPrompts.length}个` : '○' }}
          </span>
          <span class="px-2 py-0.5 rounded-full"
            :class="connectedRefImages.length > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            参考图 {{ connectedRefImages.length > 0 ? `${connectedRefImages.length}张` : '○' }}
          </span>
        </div>

        <!-- Generate button | 生成按钮 -->
        <div v-if="loading" class="flex gap-2">
          <button
            disabled
            class="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--accent-color)] text-white text-sm font-medium opacity-80 cursor-not-allowed"
          >
            <n-spin :size="14" />
            生成中...
          </button>
          <button
            @click="handleCancel"
            class="flex-shrink-0 px-3 py-2 rounded-lg border border-red-400/60 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
          >
            取消
          </button>
        </div>
        <div v-else-if="!isVideoWorkflow && hasConnectedImageWithContent" class="flex gap-2">
          <!-- Create new (primary) | 新建节点（主按钮） -->
          <button @click="handleGenerate('new')" :disabled="loading || !isConfigured"
            class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <n-spin v-if="loading" :size="14" />
            <template v-else>
              <n-icon :size="14"><AddOutline /></n-icon>
              新建生成
            </template>
          </button>
          <!-- Replace existing (secondary) | 替换现有（次按钮） -->
          <button @click="handleGenerate('replace')" :disabled="loading || !isConfigured"
            class="flex-shrink-0 flex items-center justify-center gap-1 py-2 px-2.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <n-spin v-if="loading" :size="14" />
            <template v-else>
              <n-icon :size="14"><RefreshOutline /></n-icon>
              替换
            </template>
          </button>
        </div>
        <button v-else @click="handleGenerate(isVideoWorkflow ? 'video' : 'auto')" :disabled="loading || !isConfigured"
          class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <n-spin v-if="loading" :size="14" />
          <template v-else>
            <span
              class="text-[var(--accent-color)] bg-white rounded-full w-4 h-4 flex items-center justify-center text-xs">◆</span>
            立即生成
          </template>
        </button>

        <!-- Error message | 错误信息 -->
        <div v-if="error" class="text-xs text-red-500 mt-2">
          {{ error.message || '生成失败' }}
        </div>

        <!-- Generated images preview | 生成图片预览 -->
        <!-- <div v-if="generatedImages.length > 0" class="mt-3 space-y-2">
        <div class="text-xs text-[var(--text-secondary)]">生成结果:</div>
        <div class="grid grid-cols-2 gap-2 max-w-[240px]">
          <div 
            v-for="(img, idx) in generatedImages" 
            :key="idx"
            class="aspect-square rounded-lg overflow-hidden bg-[var(--bg-tertiary)] max-w-[110px]"
          >
            <img :src="img.url" class="w-full h-full object-cover" />
          </div>
        </div>
      </div> -->
      </div>

      <!-- Handles | 连接点 -->
      <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" />
      <NodeHandleMenu :nodeId="id" nodeType="portalComfyConfig" :visible="showHandleMenu" :operations="operations" @select="handleSelect" />
    </div>
  </div>
</template>

<script setup>
/**
 * Portal ComfyUI config node | 创作工坊 ComfyUI 统一配置节点
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NDropdown, NSpin } from 'naive-ui'
import { ChevronDownOutline, ChevronForwardOutline, CopyOutline, TrashOutline, RefreshOutline, AddOutline } from '@vicons/ionicons5'
import { updateNode, addNode, addEdge, nodes, edges, duplicateNode, removeNode, currentProjectId } from '@/stores/canvas'
import NodeHandleMenu from '@/components/nodes/NodeHandleMenu.vue'
import { runPortalWorkflow, cancelPortalWorkflow, uploadPortalImage, resolvePortalAppNodeType, getPortalAppModeLabel } from '../../api/portal'
import { buildDefaultParamValues, getExposedParams, isPromptParam, isVideoApp, rememberPortalApp, resolveConnectedInputNodes, usePortalWorkflow } from '../../hooks/usePortalWorkflow'
import { parseMentions } from '../../hooks/useNodeRef'
import { useNodeAutoHeight } from '../../hooks/useNodeAutoHeight'

const { allApps, loadingApps, loadApps, loadManifest } = usePortalWorkflow()

const props = defineProps({
  id: String,
  data: Object
})

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// Workflow state | 工作流状态
const loading = ref(false)
const error = ref(null)
const activePromptId = ref(null)
const activeOutputNodeId = ref(null)
const abortController = ref(null)
const cancelledByUser = ref(false)
const localWorkflowId = ref(props.data?.workflowAppId || '')
const localWorkflowParams = ref({ ...(props.data?.workflowParams || {}) })
const currentManifest = ref(null)

// API config state | 配置状态
const isConfigured = computed(() => !!localWorkflowId.value)

const isVideoWorkflow = computed(() => {
  if (currentManifest.value) {
    return isVideoApp(currentManifest.value)
  }
  const app = allApps.value.find((item) => item.id === localWorkflowId.value)
  return app ? isVideoApp(app) : false
})

const apps = computed(() => allApps.value.filter((app) => {
  const modes = Array.isArray(app?.studio_modes) ? app.studio_modes : []
  return modes.length > 0
}))

// Workflow options | 工作流选项
const workflowOptions = computed(() =>
  apps.value.map((app) => ({
    label: `${app.name || app.id} · ${getPortalAppModeLabel(app.studio_modes, app)}`,
    key: app.id,
  }))
)

const exposedParams = computed(() => getExposedParams(currentManifest.value))

const displayWorkflowName = computed(() => {
  const app = allApps.value.find((item) => item.id === localWorkflowId.value)
  return app?.name || props.data?.workflowAppName || localWorkflowId.value || '选择工作流'
})

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

// Local state | 本地状态
const showHandleMenu = ref(false)
const isEditingLabel = ref(false)
const editingLabelValue = ref('')
const labelInputRef = ref(null)

// ImageConfig node menu operations | 图片配置节点菜单操作
const operations = [
  // { type: 'imageConfig', label: '图生图', icon: ImageOutline, action: 'imageConfig_imageConfig' }
]

// Handle menu select | 处理菜单选择
const handleSelect = (item) => {
  const action = item.action

  if (action === 'imageConfig_imageConfig') {
    // Image-to-image (create new image node for editing) | 图生图（创建新图片节点用于编辑）
    const currentNode = nodes.value.find(n => n.id === props.id)
    const nodeX = currentNode?.position?.x || 0
    const nodeY = currentNode?.position?.y || 0

    // Create new image node for editing
    const imageNodeId = addNode('image', { x: nodeX + 400, y: nodeY }, {
      label: '图片编辑'
    })

    // Connect current config to new image node
    addEdge({
      source: props.id,
      target: imageNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })

    setTimeout(() => updateNodeInternals(imageNodeId), 50)
    window.$message?.success('已创建图片编辑节点')
  }
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

const resolveWorkflowMode = (appOrManifest) => {
  const { workflowMode } = resolvePortalAppNodeType(appOrManifest?.studio_modes || [])
  return workflowMode
}

const handleWorkflowSelect = async (appId) => {
  localWorkflowId.value = appId
  rememberPortalApp(appId)
  await applyManifest(appId, true)
  const app = allApps.value.find((item) => item.id === appId)
  const appName = app?.name || appId
  const manifest = currentManifest.value || app
  updateNode(props.id, {
    label: appName,
    workflowAppName: appName,
    workflowAppId: appId,
    workflowMode: resolveWorkflowMode(manifest),
    workflowParams: { ...localWorkflowParams.value },
  })
}

const handleParamChange = (key, value) => {
  localWorkflowParams.value = {
    ...localWorkflowParams.value,
    [key]: value,
  }
  updateNode(props.id, {
    workflowParams: { ...localWorkflowParams.value },
  })
}

// Initialize on mount | 挂载时初始化
onMounted(async () => {
  await loadApps()
  if (localWorkflowId.value) {
    await applyManifest(localWorkflowId.value)
  }
})

useNodeAutoHeight(props.id, [loading])

// 解析 textNode 内容中的 @ 引用，转换为简短引用（如 图 1）并收集图片
const resolveTextMentionsForImage = (textNode) => {
  const content = textNode.data?.content || ''
  const mentions = parseMentions(content)

  if (mentions.length === 0) {
    return { resolvedContent: content, refImages: [] }
  }

  // 收集引用的图片节点
  const imageMentions = []
  for (const mention of mentions) {
    const referencedNode = nodes.value.find(n => n.id === mention.nodeId)
    if (referencedNode?.type === 'image') {
      const imageData = referencedNode.data?.base64 || referencedNode.data?.url
      if (imageData) {
        imageMentions.push({
          order: mention.order,
          nodeId: mention.nodeId,
          imageData
        })
      }
    }
  }

  if (imageMentions.length === 0) {
    return { resolvedContent: content, refImages: [] }
  }

  // 按出现顺序排序
  imageMentions.sort((a, b) => a.order - b.order)

  // 替换 @[nodeId] 为按顺序的 "图1"、"图2" 等
  let resolvedContent = content
  for (let i = 0; i < imageMentions.length; i++) {
    const mention = imageMentions[i]
    const placeholder = `@[${mention.nodeId}]`
    // 按排序后的索引替换为 "图1"、"图2" 等
    resolvedContent = resolvedContent.replace(placeholder, `图${i + 1}`)
  }

  // 返回解析后的内容和图片数组（按引用顺序）
  const refImages = imageMentions.map(m => m.imageData)

  return { resolvedContent, refImages }
}

// Computed connected prompts (sorted by order) | 计算连接的提示词（按顺序排列）
const connectedPrompts = computed(() => {
  return getConnectedInputs().prompts
})

// Computed connected reference images | 计算连接的参考图
const connectedRefImages = computed(() => {
  return getConnectedInputs().refImages
})

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

const inputParamPreviews = computed(() =>
  resolveConnectedInputNodes(props.id, currentManifest.value, nodes.value, edges.value)
)

// 已连接的文本节点 ID 列表（用于 @ 提及时过滤）
const connectedTextNodeIds = computed(() => {
  const incomingEdges = edges.value.filter(e => e.target === props.id)
  const connectedIds = []
  for (const edge of incomingEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (sourceNode?.type === 'text') {
      connectedIds.push(sourceNode.id)
    }
  }
  return connectedIds
})

// Get connected nodes | 获取连接的节点
const getConnectedInputs = () => {
  // 1. First check @ mentions | 首先检查 @ 引用
  // Only check connected TextNodes | 只检查已连接的 TextNode
  const textNodes = nodes.value.filter(n => n.type === 'text' && connectedTextNodeIds.value.includes(n.id))
  const mentionsPrompts = []
  const mentionsRefImages = []

  for (const textNode of textNodes) {
    const { resolvedContent, refImages: nodeRefImages } = resolveTextMentionsForImage(textNode)

    // 如果有解析出图片引用
    if (nodeRefImages.length > 0) {
      // 添加解析后的提示词内容
      mentionsPrompts.push({
        order: mentionsPrompts.length,
        content: resolvedContent,
        nodeId: textNode.id
      })

      // 添加参考图
      for (const imageData of nodeRefImages) {
        mentionsRefImages.push({
          order: mentionsRefImages.length,
          imageData,
          nodeId: textNode.id
        })
      }
    }
  }

  // 2. Get edge-connected ImageNodes | 获取边连接的 ImageNode
  const connectedEdges = edges.value.filter(e => e.target === props.id)
  const edgeRefImages = [] // Array of { order, imageData, nodeId } | 参考图数组

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'image') {
      // Prefer base64, fallback to url | 优先使用 base64，回退到 url
      const imageData = sourceNode.data?.base64 || sourceNode.data?.url
      if (imageData) {
        // Get order from edge data, default to 1 | 从边数据获取顺序，默认为1
        // Add offset of @ mentions count | 加上 @ 提及图片数量的偏移
        const baseOrder = edge.data?.imageOrder || 1
        const order = mentionsRefImages.length + baseOrder
        edgeRefImages.push({ order, imageData, nodeId: sourceNode.id })
      }
    }
  }

  // 3. Merge and sort refImages | 合并并排序参考图
  // Combine @ mentions refImages and edge-connected refImages | 合并 @ 提及和边连接的图片
  const allRefImages = [...mentionsRefImages, ...edgeRefImages]
  // Sort by order | 按顺序排序
  allRefImages.sort((a, b) => a.order - b.order)
  const sortedRefImages = allRefImages.map(r => r.imageData)

  // 4. If there are @ mentions, use them | 如果有 @ 提及，使用它们
  if (mentionsPrompts.length > 0) {
    // Sort prompts by order | 按顺序排序提示词
    mentionsPrompts.sort((a, b) => a.order - b.order)
    const combinedPrompt = mentionsPrompts.map(p => p.content).join('\n\n')

    return {
      prompt: combinedPrompt,
      prompts: mentionsPrompts,
      refImages: sortedRefImages,
      refImagesWithOrder: allRefImages,
      fromMentions: true
    }
  }

  // 5. Fallback to edge connections | 降级到边的连接
  // (only prompts, no @ mentions) （只有提示词，没有 @ 提及）
  const prompts = [] // Array of { order, content } | 提示词数组

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'text') {
      const content = sourceNode.data?.content || ''
      if (content) {
        // Get order from edge data, default to 1 | 从边数据获取顺序，默认为1
        const order = edge.data?.promptOrder || 1
        prompts.push({ order, content, nodeId: sourceNode.id })
      }
    } else if (sourceNode.type === 'llmConfig') {
      // LLM node output as prompt | LLM 节点输出作为提示词
      const content = sourceNode.data?.outputContent || ''
      if (content) {
        const order = edge.data?.promptOrder || 1
        prompts.push({ order, content, nodeId: sourceNode.id })
      }
    }
    // Note: ImageNode handling moved to step 2 above | 注意：ImageNode 处理已移至步骤 2
  }

  // Sort prompts by order and concatenate | 按顺序排序并拼接
  prompts.sort((a, b) => a.order - b.order)
  const combinedPrompt = prompts.map(p => p.content).join('\n\n')

  // Use edge-connected refImages (already sorted above) | 使用边连接的参考图（已在上面排序）
  return { prompt: combinedPrompt, prompts, refImages: sortedRefImages, refImagesWithOrder: allRefImages, fromMentions: false }
}

// Created image node ID | 创建的图片节点 ID
const createdImageNodeId = ref(null)

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

const handleCancel = async () => {
  if (!loading.value) return
  cancelledByUser.value = true
  abortController.value?.abort()
  const promptId = activePromptId.value
  if (promptId) {
    try {
      await cancelPortalWorkflow(promptId)
    } catch (err) {
      console.warn('[PortalComfyConfigNode] cancel failed:', err)
    }
  }
  resetOutputNodeAfterCancel()
  loading.value = false
  activePromptId.value = null
  activeOutputNodeId.value = null
  abortController.value = null
  window.$message?.info('任务已取消')
}

const runWorkflowWithCancel = (runParams, prompt, outputNodeId, { timeoutSec = 600 } = {}) => {
  cancelledByUser.value = false
  abortController.value = new AbortController()
  activePromptId.value = null
  activeOutputNodeId.value = outputNodeId

  return runPortalWorkflow(localWorkflowId.value, runParams, {
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
      const uploadedName = await uploadPortalImage(refImages[0])
      for (const param of unboundParams) {
        runParams[param.key] = uploadedName
      }
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

const isImageInputActive = (sourceNode) => {
  if (!sourceNode?.data) return false
  if (sourceNode.data.portalParamKey) {
    return !!(sourceNode.data.base64 || sourceNode.data.url)
  }
  return !!(sourceNode.data.publicProps?.name || sourceNode.data.base64 || sourceNode.data.url)
}

const getVideoConnectedInputs = () => {
  const connectedEdges = edges.value.filter((edge) => edge.target === props.id)
  let prompt = ''
  let first_frame_image = ''
  let last_frame_image = ''
  const images = []

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find((node) => node.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'text') {
      prompt = sourceNode.data?.content || prompt
    } else if (sourceNode.type === 'llmConfig') {
      const content = sourceNode.data?.outputContent || ''
      if (content) prompt = content
    } else if (sourceNode.type === 'image' && isImageInputActive(sourceNode)) {
      const imageData = sourceNode.data?.base64 || sourceNode.data?.url
      if (!imageData) continue
      const role = edge.data?.imageRole || 'input_reference'
      if (role === 'first_frame_image') {
        first_frame_image = imageData
      } else if (role === 'last_frame_image') {
        last_frame_image = imageData
      } else {
        images.push(imageData)
      }
    }
  }

  return { prompt, first_frame_image, last_frame_image, images }
}

const buildVideoRunParams = async (inputs) => {
  const { prompt, first_frame_image, last_frame_image, images } = inputs
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

// Find connected output image node | 查找已连接的输出图片节点
const findConnectedOutputImageNode = (onlyEmpty = true) => {
  const outputEdges = edges.value.filter(e => e.source === props.id)
  const connectedImages = outputEdges
    .map((edge) => nodes.value.find((n) => n.id === edge.target))
    .filter((node) => node?.type === 'image')

  const selectedTarget = connectedImages.find((node) => node.data?.selected)
  if (selectedTarget) {
    if (!onlyEmpty || !selectedTarget.data?.url || selectedTarget.data.url === '') {
      return selectedTarget.id
    }
  }

  for (const targetNode of connectedImages) {
    if (onlyEmpty) {
      if (!targetNode.data?.url || targetNode.data?.url === '') {
        return targetNode.id
      }
    } else {
      return targetNode.id
    }
  }
  return null
}

// Check if there's a connected image node with content | 检查是否有已连接且有内容的图片节点
const hasConnectedImageWithContent = computed(() => {
  const outputEdges = edges.value.filter(e => e.source === props.id)
  
  for (const edge of outputEdges) {
    const targetNode = nodes.value.find(n => n.id === edge.target)
    if (targetNode?.type === 'image' && targetNode.data?.url && targetNode.data.url !== '') {
      return true
    }
  }
  return false
})

// Handle generate action | 处理生成操作
const handleGenerate = async (mode = 'auto') => {
  if (mode === 'video' || isVideoWorkflow.value) {
    await handleGenerateVideo()
    return
  }
  await handleGenerateImage(mode)
}

const handleGenerateVideo = async () => {
  const { prompt, first_frame_image, last_frame_image, images } = getVideoConnectedInputs()
  const { textByKey, imagesByKey } = getConnectedParamInputs()
  const hasInput = prompt
    || first_frame_image
    || last_frame_image
    || images.length > 0
    || Object.values(textByKey).some(Boolean)
    || Object.values(imagesByKey).some(Boolean)

  if (!hasInput) {
    window.$message?.warning('请连接输入节点并填写文本或上传图片')
    return
  }

  if (!isConfigured.value) {
    window.$message?.warning('请先选择创作工坊工作流')
    return
  }

  loading.value = true
  error.value = null

  const currentNode = nodes.value.find((node) => node.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  const videoNodeId = addNode('video', { x: nodeX + 350, y: nodeY }, {
    url: '',
    loading: true,
    label: '视频生成中...',
  })

  addEdge({
    source: props.id,
    target: videoNodeId,
    sourceHandle: 'right',
    targetHandle: 'left',
  })

  setTimeout(() => updateNodeInternals(videoNodeId), 50)

  try {
    const runParams = await buildVideoRunParams({ prompt, first_frame_image, last_frame_image, images })
    const result = await runWorkflowWithCancel(runParams, prompt, videoNodeId, { timeoutSec: 900 })
    const videoUrl = resolveResultUrl(result, true)

    if (videoUrl) {
      updateNode(videoNodeId, {
        url: videoUrl,
        loading: false,
        label: props.data?.workflowAppName || '视频生成',
        workflowAppId: localWorkflowId.value,
        updatedAt: Date.now(),
      })
      updateNode(props.id, { executed: true, outputNodeId: videoNodeId })
      window.$message?.success('视频生成成功')
    } else {
      throw new Error('工作流已完成，但没有返回视频结果')
    }
  } catch (err) {
    if (err?.name === 'AbortError' || cancelledByUser.value) {
      return
    }
    error.value = err
    updateNode(videoNodeId, {
      loading: false,
      error: err.message || '生成失败',
      label: '生成失败',
      updatedAt: Date.now(),
    })
    window.$message?.error(err.message || '视频生成失败')
  } finally {
    loading.value = false
    activePromptId.value = null
    activeOutputNodeId.value = null
    abortController.value = null
  }
}

const handleGenerateImage = async (mode = 'auto') => {
  const { prompt, prompts, refImages, refImagesWithOrder } = getConnectedInputs()
  const { textByKey, imagesByKey } = getConnectedParamInputs()
  const hasTextInput = !!prompt || Object.values(textByKey).some(Boolean)
  const hasImageInput = refImages.length > 0 || Object.values(imagesByKey).some(Boolean)

  if (!hasTextInput && !hasImageInput) {
    window.$message?.warning('请连接输入节点并填写文本或上传图片')
    return
  }
  
  // Log prompt order for debugging | 记录提示词顺序用于调试
  if (prompts.length > 1) {
    console.log('[ImageConfigNode] 拼接提示词顺序:', prompts.map(p => `${p.order}: ${p.content.substring(0, 20)}...`))
  }
  
  // Log image order for debugging | 记录图片顺序用于调试
  if (refImagesWithOrder && refImagesWithOrder.length > 1) {
    console.log('[ImageConfigNode] 参考图顺序:', refImagesWithOrder.map(r => `${r.order}: ${r.nodeId}`))
  }

  if (!isConfigured.value) {
    window.$message?.warning('请先选择创作工坊工作流')
    return
  }

  let imageNodeId = null
  loading.value = true
  error.value = null
  
  if (mode === 'replace') {
    // Replace mode: find any connected image node | 替换模式：查找任意连接的图片节点
    imageNodeId = findConnectedOutputImageNode(false)
    if (imageNodeId) {
      updateNode(imageNodeId, { loading: true, url: '' })
    }
  } else if (mode === 'new') {
    // New mode: always create new node | 新建模式：始终创建新节点
    imageNodeId = null
  } else {
    // Auto mode: check for empty connected node first | 自动模式：先检查空白连接节点
    imageNodeId = findConnectedOutputImageNode(true)
    if (imageNodeId) {
      updateNode(imageNodeId, { loading: true })
    }
  }
  
  if (!imageNodeId) {
    // Get current node position | 获取当前节点位置
    const currentNode = nodes.value.find(n => n.id === props.id)
    const nodeX = currentNode?.position?.x || 0
    const nodeY = currentNode?.position?.y || 0
    
    // Calculate Y offset if creating new node alongside existing | 如果是新建节点，计算Y偏移
    let yOffset = 0
    if (mode === 'new') {
      const outputEdges = edges.value.filter(e => e.source === props.id)
      yOffset = outputEdges.length * 280 // Stack below existing outputs | 在现有输出下方堆叠
    }

    // Create image node with loading state | 创建带加载状态的图片节点
    imageNodeId = addNode('image', { x: nodeX + 400, y: nodeY + yOffset }, {
      url: '',
      loading: true,
      label: '图像生成结果'
    })

    // Auto-connect imageConfig → image | 自动连接 生图配置 → 图片
    addEdge({
      source: props.id,
      target: imageNodeId,
      sourceHandle: 'right',
      targetHandle: 'left'
    })
  }
  
  createdImageNodeId.value = imageNodeId

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals(imageNodeId)
  }, 50)

  try {
    const runParams = await buildRunParams(prompt, refImages)
    const result = await runWorkflowWithCancel(runParams, prompt, imageNodeId, { timeoutSec: 600 })
    const imageUrl = resolveResultUrl(result, false)

    if (imageUrl) {
      updateNode(imageNodeId, {
        url: imageUrl,
        loading: false,
        label: props.data?.workflowAppName || '图像生成',
        workflowAppId: localWorkflowId.value,
        updatedAt: Date.now()
      })
      
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { executed: true, outputNodeId: imageNodeId })
      window.$message?.success('图片生成成功')
    } else {
      throw new Error('工作流已完成，但没有返回图片结果')
    }
  } catch (err) {
    if (err?.name === 'AbortError' || cancelledByUser.value) {
      return
    }
    error.value = err
    // Update node to show error | 更新节点显示错误
    updateNode(imageNodeId, {
      loading: false,
      error: err.message || '生成失败',
      updatedAt: Date.now()
    })
    window.$message?.error(err.message || '图片生成失败')
  } finally {
    loading.value = false
    activePromptId.value = null
    activeOutputNodeId.value = null
    abortController.value = null
  }
}

// Handle duplicate | 处理复制
const handleDuplicate = () => {
  const newNodeId = duplicateNode(props.id)
  window.$message?.success('节点已复制')
  if (newNodeId) {
    setTimeout(() => {
      updateNodeInternals(newNodeId)
    }, 50)
  }
}

// Start editing label | 开始编辑 label
const startEditLabel = () => {
  editingLabelValue.value = props.data?.label || ''
  isEditingLabel.value = true
  nextTick(() => {
    labelInputRef.value?.focus()
    labelInputRef.value?.select()
  })
}

// Finish editing label | 完成编辑 label
const finishEditLabel = () => {
  const newLabel = editingLabelValue.value.trim()
  if (newLabel && newLabel !== props.data?.label) {
    updateNode(props.id, { label: newLabel })
  }
  isEditingLabel.value = false
}

// Cancel editing label | 取消编辑 label
const cancelEditLabel = () => {
  isEditingLabel.value = false
}

// Handle delete | 处理删除
const handleDelete = () => {
  removeNode(props.id)
  window.$message?.success('节点已删除')
}

watch(() => props.data?.workflowAppId, async (newAppId) => {
  if (newAppId && newAppId !== localWorkflowId.value) {
    localWorkflowId.value = newAppId
    await applyManifest(newAppId)
  }
})

watch(() => props.data?.workflowParams, (nextParams) => {
  if (nextParams && typeof nextParams === 'object') {
    localWorkflowParams.value = { ...nextParams }
  }
}, { deep: true })

// 修复 Vue Flow visibility: hidden 问题
watch(() => props.data, () => {
  nextTick(() => {
    updateNodeInternals(props.id)
  })
}, { deep: true })

// Watch for auto-execute flag | 监听自动执行标志
watch(
  () => props.data?.autoExecute,
  (shouldExecute) => {
    if (shouldExecute && !loading.value) {
      // Clear the flag first to prevent re-triggering | 先清除标志防止重复触发
      updateNode(props.id, { autoExecute: false })
      // Delay to ensure node connections are established | 延迟确保节点连接已建立
      setTimeout(() => {
        handleGenerate()
      }, 100)
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.portal-comfy-config-node-wrapper {
  position: relative;
}

.portal-comfy-config-node {
  cursor: default;
  position: relative;
}
</style>
