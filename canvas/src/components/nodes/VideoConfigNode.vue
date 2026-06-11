<template>
  <!-- Video config node wrapper | 视频配置节点包裹层 -->
  <div class="video-config-node-wrapper" @mouseenter="showHandleMenu = true" @mouseleave="showHandleMenu = false">
    <!-- Video config node | 视频配置节点 -->
    <div class="video-config-node bg-[var(--bg-secondary)] rounded-xl border min-w-[300px] transition-all duration-200"
      :class="data.selected ? 'border-1 border-blue-500 shadow-lg shadow-blue-500/20' : 'border border-[var(--border-color)]'">
      <!-- Header | 头部 -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
        <span
          v-if="!isEditingLabel"
          @dblclick="startEditLabel"
          class="text-sm font-medium text-[var(--text-secondary)] cursor-text hover:bg-[var(--bg-tertiary)] px-1 rounded transition-colors"
          title="双击编辑名称"
        >{{ data.label || '视频生成' }}</span>
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
        <!-- Model selector | 模型选择（含 ComfyUI 工作流） -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">模型</span>
          <n-dropdown :options="modelOptions" @select="handleModelSelect">
            <button class="flex items-center gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)] max-w-[180px] truncate">
              {{ displayModelName }}
              <n-icon :size="12"><ChevronDownOutline /></n-icon>
            </button>
          </n-dropdown>
        </div>

        <!-- Aspect ratio selector | 宽高比选择 -->
        <div v-if="!hasPortalWorkflow" class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">比例</span>
          <n-dropdown :options="ratioOptions" @select="handleRatioSelect">
            <button class="flex items-center gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)]">
              {{ localRatio }}
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </n-dropdown>
        </div>

        <!-- Duration selector | 时长选择 -->
        <div v-if="!hasPortalWorkflow" class="flex items-center justify-between">
          <span class="text-xs text-[var(--text-secondary)]">时长</span>
          <n-dropdown :options="durationOptions" @select="handleDurationSelect">
            <button class="flex items-center gap-1 text-sm text-[var(--text-primary)] hover:text-[var(--accent-color)]">
              {{ localDuration }}s
              <n-icon :size="12">
                <ChevronForwardOutline />
              </n-icon>
            </button>
          </n-dropdown>
        </div>

        <!-- Connected inputs indicator | 连接输入指示 -->
        <div
          class="flex items-center gap-2 text-xs text-[var(--text-secondary)] py-1 border-t border-[var(--border-color)]">
          <span class="px-2 py-0.5 rounded-full"
            :class="connectedPrompt ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            提示词 {{ connectedPrompt ? '✓' : '○' }}
          </span>
          <span class="px-2 py-0.5 rounded-full"
            :class="imagesByRole.firstFrame ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            首帧 {{ imagesByRole.firstFrame ? '✓' : '○' }}
          </span>
          <span class="px-2 py-0.5 rounded-full"
            :class="imagesByRole.lastFrame ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            尾帧 {{ imagesByRole.lastFrame ? '✓' : '○' }}
          </span>
          <span class="px-2 py-0.5 rounded-full"
            :class="imagesByRole.referenceImages.length > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'">
            参考图 {{ imagesByRole.referenceImages.length > 0 ? `✓ ${imagesByRole.referenceImages.length}` : '○' }}
          </span>
        </div>

        <!-- Progress bar | 进度条 -->
        <!-- <div v-if="status === 'polling'" class="space-y-1">
        <div class="flex justify-between text-xs text-[var(--text-secondary)]">
          <span>生成中...</span>
          <span>{{ progress.percentage }}%</span>
        </div>
        <n-progress type="line" :percentage="progress.percentage" :show-indicator="false" :height="4" />
      </div> -->

        <!-- Generate button | 生成按钮 -->
        <div v-if="portalLoading" class="flex gap-2">
          <button
            disabled
            class="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--accent-color)] text-white text-sm font-medium opacity-80 cursor-not-allowed"
          >
            <n-spin :size="14" />
            生成中...
          </button>
          <button
            @click="handlePortalCancel"
            class="flex-shrink-0 px-3 py-2 rounded-lg border border-red-400/60 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
          >
            取消
          </button>
        </div>
        <button v-else @click="handleGenerate" :disabled="!isConfigured"
          class="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors"
          :class="isExecuting ? 'bg-red-500 hover:bg-red-600' : 'bg-[var(--accent-color)] hover:bg-[var(--accent-hover)]'"
          :title="isExecuting ? '点击中断执行' : '点击开始生成视频'">
          <n-spin v-if="isExecuting" :size="14" />
          <n-icon v-else :size="16">
            <VideocamOutline />
          </n-icon>
          {{ isExecuting ? '生成中... 点击中断' : '生成视频' }}
        </button>

        <!-- Error message | 错误信息 -->
        <div v-if="error" class="text-xs text-red-500 mt-2">
          {{ error.message || '生成失败' }}
        </div>

        <!-- Generated video preview | 生成视频预览 -->
        <!-- <div v-if="generatedVideo?.url" class="mt-3 space-y-2">
        <div class="text-xs text-[var(--text-secondary)]">生成结果:</div>
        <div class="aspect-video rounded-lg overflow-hidden bg-black">
          <video :src="generatedVideo.url" controls class="w-full h-full object-contain" />
        </div>
      </div> -->
      </div>

      <!-- Handles | 连接点 -->
      <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" />
      <NodeHandleMenu :nodeId="id" nodeType="videoConfig" :visible="showHandleMenu" :operations="[]" />
    </div>
  </div>
</template>

<script setup>
/**
 * Video config node component | 视频配置节点组件
 * Configuration panel for video generation with API integration
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { Handle, Position, useVueFlow } from '@vue-flow/core'
import { NIcon, NDropdown, NSpin } from 'naive-ui'
import { ChevronForwardOutline, ChevronDownOutline, TrashOutline, VideocamOutline, CopyOutline, CreateOutline } from '@vicons/ionicons5'
import { useVideoGeneration } from '../../hooks'
import { updateNode, removeNode, duplicateNode, addNode, addEdge, nodes, edges } from '../../stores/canvas'
import NodeHandleMenu from '@/components/nodes/NodeHandleMenu.vue'
import { useModelStore } from '../../stores/pinia'
import { getModelRatioOptions, getModelDurationOptions, getModelConfig, DEFAULT_VIDEO_MODEL } from '../../stores/models'
import { useConfigNodePortal, isPortalModelKey } from '../../hooks/useConfigNodePortal'
import { useNodeAutoHeight } from '../../hooks/useNodeAutoHeight'

// 使用 Pinia store 获取模型选项（根据渠道过滤）
const modelStore = useModelStore()

const props = defineProps({
  id: String,
  data: Object
})

const portal = useConfigNodePortal(props, {
  defaultStudioMode: 't2v',
  allowedModes: ['t2v', 'i2v'],
  nodes,
  edges,
})

const {
  portalModelOptions,
  displayWorkflowName,
  displayStudioMode,
  hasPortalWorkflow,
  portalLoading,
  localWorkflowId,
  selectFromModelKey,
  resolveInitialModelKey,
  buildVideoRunParams,
  runPortal,
  handlePortalCancel,
} = portal

// Vue Flow instance | Vue Flow 实例
const { updateNodeInternals } = useVueFlow()

// API config state | API 配置状态
const isConfigured = computed(() => !!modelStore.currentApiKey || hasPortalWorkflow.value)

// Video generation hook | 视频生成 hook
const { loading, error, status, video: generatedVideo, progress, createVideoTaskOnly, reset } = useVideoGeneration()

// Local state | 本地状态
const showHandleMenu = ref(false)
const isExecuting = ref(false)      // 执行中状态
const abortController = ref(null)   // 中断控制器
const localModel = ref(
  resolveInitialModelKey() || props.data?.model || DEFAULT_VIDEO_MODEL
)
const localRatio = ref(props.data?.ratio || '16:9')
const localDuration = ref(props.data?.dur || 5)

// Label editing state | Label 编辑状态
const isEditingLabel = ref(false)
const editingLabelValue = ref('')
const labelInputRef = ref(null)

// Get connected images with roles | 获取连接的图片及其角色
const connectedImages = computed(() => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)
  const images = []

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (sourceNode?.type === 'image' && sourceNode.data?.url) {
      images.push({
        nodeId: sourceNode.id,
        edgeId: edge.id,
        url: sourceNode.data.url,
        base64: sourceNode.data.base64,
        role: edge.data?.imageRole || 'first_frame_image' // Default to first frame | 默认首帧
      })
    }
  }

  return images
})

// Get images by role | 按角色获取图片
const imagesByRole = computed(() => {
  const firstFrame = connectedImages.value.find(img => img.role === 'first_frame_image')
  const lastFrame = connectedImages.value.find(img => img.role === 'last_frame_image')
  const referenceImages = connectedImages.value.filter(img => img.role === 'input_reference')

  return {
    firstFrame,
    lastFrame,
    referenceImages
  }
})

// Model options from Pinia store + portal workflows | 云端模型 + ComfyUI 工作流
const modelOptions = computed(() => [
  ...modelStore.allVideoModelOptions,
  ...portalModelOptions.value,
])

// Display model name | 显示模型名称
const displayModelName = computed(() => {
  if (isPortalModelKey(localModel.value)) {
    const portalOption = portalModelOptions.value.find((item) => item.key === localModel.value)
    return portalOption?.label || displayWorkflowName.value
  }
  const model = modelOptions.value.find(m => m.key === localModel.value)
  if (!model) {
    const allModel = modelStore.allVideoModels.find(m => m.key === localModel.value)
    return allModel?.label || localModel.value || '选择模型'
  }
  return model?.label || localModel.value || '选择模型'
})

// Get current model config | 获取当前模型配置
const currentModelConfig = computed(() => {
  if (hasPortalWorkflow.value) return null
  return getModelConfig(localModel.value)
})

// Ratio options based on model | 基于模型的比例选项
const ratioOptions = computed(() => {
  return getModelRatioOptions(localModel.value)
})

// Duration options based on model | 基于模型的时长选项
const durationOptions = computed(() => {
  return getModelDurationOptions(localModel.value)
})

// Handle model selection | 处理模型选择
const handleModelSelect = async (key) => {
  localModel.value = key
  const isPortal = await selectFromModelKey(key)
  if (isPortal) return

  const config = getModelConfig(key)
  const updates = { model: key }
  if (config?.defaultParams?.ratio) {
    localRatio.value = config.defaultParams.ratio
    updates.ratio = config.defaultParams.ratio
  }
  if (config?.defaultParams?.duration) {
    localDuration.value = config.defaultParams.duration
    updates.dur = config.defaultParams.duration
  }
  updateNode(props.id, updates)
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

// Handle ratio selection | 处理比例选择
const handleRatioSelect = (key) => {
  localRatio.value = key
  updateNode(props.id, { ratio: key })
}

// Handle duration selection | 处理时长选择
const handleDurationSelect = (key) => {
  localDuration.value = key
  updateNode(props.id, { dur: key })
}

// Get connected inputs by role | 根据角色获取连接的输入
const getConnectedInputs = () => {
  const connectedEdges = edges.value.filter(e => e.target === props.id)

  let prompt = ''
  let first_frame_image = ''
  let last_frame_image = ''
  const images = [] // input_reference images | 参考图

  for (const edge of connectedEdges) {
    const sourceNode = nodes.value.find(n => n.id === edge.source)
    if (!sourceNode) continue

    if (sourceNode.type === 'text') {
      prompt = sourceNode.data?.content || ''
    } else if (sourceNode.type === 'llmConfig') {
      // LLM node output as prompt | LLM 节点输出作为提示词
      const content = sourceNode.data?.outputContent || ''
      if (content) prompt = content
    } else if (sourceNode.type === 'image' && sourceNode.data?.url) {
      const imageData = sourceNode.data.base64 || sourceNode.data.url
      const role = edge.data?.imageRole || 'first_frame_image'

      if (role === 'first_frame_image') {
        first_frame_image = imageData
      } else if (role === 'last_frame_image') {
        last_frame_image = imageData
      } else if (role === 'input_reference') {
        images.push(imageData)
      }
    }
  }

  return { prompt, first_frame_image, last_frame_image, images }
}

// Computed connected prompt | 计算连接的提示词
const connectedPrompt = computed(() => {
  return getConnectedInputs().prompt
})

// Created video node ID | 创建的视频节点 ID
const createdVideoNodeId = ref(null)

// Handle generate action | 处理生成操作
const handlePortalGenerate = async () => {
  const { prompt, first_frame_image, last_frame_image, images } = getConnectedInputs()
  const hasInput = prompt || first_frame_image || last_frame_image || images.length > 0

  if (!hasInput) {
    window.$message?.warning('请先连接文本节点或图片节点')
    return
  }

  if (!hasPortalWorkflow.value) {
    window.$message?.warning('请先选择工作流')
    return
  }

  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  const videoNodeId = addNode('video', { x: nodeX + 350, y: nodeY }, {
    url: '',
    loading: true,
    label: '视频生成中...',
  })
  createdVideoNodeId.value = videoNodeId

  addEdge({
    source: props.id,
    target: videoNodeId,
    sourceHandle: 'right',
    targetHandle: 'left',
  })

  setTimeout(() => updateNodeInternals(videoNodeId), 50)

  try {
    const videoUrl = await runPortal(
      () => buildVideoRunParams({ prompt, first_frame_image, last_frame_image, images }),
      prompt,
      videoNodeId,
      { timeoutSec: 900, video: true },
    )

    if (videoUrl) {
      updateNode(videoNodeId, {
        url: videoUrl,
        loading: false,
        label: displayWorkflowName.value || displayStudioMode.value,
        workflowAppId: localWorkflowId.value,
        updatedAt: Date.now(),
      })
      updateNode(props.id, { executed: true, outputNodeId: videoNodeId })
      window.$message?.success('视频生成成功')
    } else {
      throw new Error('工作流已完成，但没有返回视频结果')
    }
  } catch (err) {
    if (err?.name === 'AbortError') return
    updateNode(videoNodeId, {
      loading: false,
      error: err.message || '生成失败',
      label: '生成失败',
      updatedAt: Date.now(),
    })
    window.$message?.error(err.message || '视频生成失败')
  }
}

const handleGenerate = async () => {
  if (portalLoading.value) {
    await handlePortalCancel()
    return
  }
  if (hasPortalWorkflow.value) {
    await handlePortalGenerate()
    return
  }

  // 如果正在执行中，触发中断 | If executing, trigger abort
  if (isExecuting.value) {
    abortController.value?.abort()
    return
  }

  // 设置生成中状态
  isExecuting.value = true
  abortController.value = new AbortController()
  reset()

  const { prompt, first_frame_image, last_frame_image, images } = getConnectedInputs()

  const hasInput = prompt || first_frame_image || last_frame_image || images.length > 0
  if (!hasInput) {
    window.$message?.warning('请先连接文本节点或图片节点')
    isExecuting.value = false
    abortController.value = null
    return
  }

  if (!isConfigured.value) {
    window.$message?.warning('请先配置 API Key')
    isExecuting.value = false
    abortController.value = null
    return
  }

  // Get current node position | 获取当前节点位置
  const currentNode = nodes.value.find(n => n.id === props.id)
  const nodeX = currentNode?.position?.x || 0
  const nodeY = currentNode?.position?.y || 0

  // Create video node with loading state | 创建带加载状态的视频节点
  const videoNodeId = addNode('video', { x: nodeX + 350, y: nodeY }, {
    url: '',
    loading: true,
    label: '视频生成中...'
  })
  createdVideoNodeId.value = videoNodeId

  // Auto-connect videoConfig → video | 自动连接 视频配置 → 视频
  addEdge({
    source: props.id,
    target: videoNodeId,
    sourceHandle: 'right',
    targetHandle: 'left'
  })

  // Force Vue Flow to recalculate node dimensions | 强制 Vue Flow 重新计算节点尺寸
  setTimeout(() => {
    updateNodeInternals(videoNodeId)
  }, 50)

  try {
    // Build request params (raw form data) | 构建请求参数（原始表单数据）
    // These will be transformed by inputTransform | 这些会被 inputTransform 转换
    const params = {
      model: localModel.value
    }

    // Add prompt if provided | 如果有提示词则添加
    if (prompt) {
      params.prompt = prompt
    }

    // Add first frame image | 添加首帧图片
    if (first_frame_image) {
      params.first_frame_image = first_frame_image
    }

    // Add last frame image | 添加尾帧图片
    if (last_frame_image) {
      params.last_frame_image = last_frame_image
    }

    // Add reference images (input_reference) | 添加参考图
    if (images.length > 0) {
      params.images = images
    }

    // Add ratio/size | 添加比例参数
    if (localRatio.value) {
      params.ratio = localRatio.value
    }

    // Add duration | 添加时长
    if (localDuration.value) {
      params.dur = localDuration.value
    }

    // 只创建任务，获取 taskId，不在这里轮询
    const { taskId: newTaskId, url } = await createVideoTaskOnly(params, abortController.value.signal)

    // 如果有直接 URL，更新视频节点
    if (url) {
      updateNode(videoNodeId, {
        url: url,
        loading: false,
        label: '视频生成',
        model: localModel.value,
        updatedAt: Date.now()
      })
      window.$message?.success('视频生成成功')
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { executed: true, outputNodeId: videoNodeId })
    } else if (newTaskId) {
      // 需要轮询，传递 taskId 给 VideoNode
      updateNode(videoNodeId, {
        taskId: newTaskId,
        loading: true,
        label: '视频生成中...',
        model: localModel.value,
        updatedAt: Date.now()
      })
      window.$message?.success('视频任务已创建')
      // Mark this config node as executed | 标记配置节点已执行
      updateNode(props.id, { executed: true, outputNodeId: videoNodeId })
    }
  } catch (err) {
    // 忽略中断错误 | Ignore abort errors
    if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
      updateNode(videoNodeId, { loading: false, label: '已中断', updatedAt: Date.now() })
      window.$message?.info('已中断视频生成')
    } else {
      // Update node to show error | 更新节点显示错误
      updateNode(videoNodeId, {
        loading: false,
        error: err.message || '生成失败',
        label: '生成失败',
        updatedAt: Date.now()
      })
      window.$message?.error(err.message || '视频生成失败')
    }
  } finally {
    isExecuting.value = false
    abortController.value = null
  }
}

// Start editing label | 开始编辑 label
const startEditLabel = () => {
  editingLabelValue.value = props.data?.label || '视频生成'
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
}

// Initialize on mount | 挂载时初始化
onMounted(() => {
  if (!isPortalModelKey(localModel.value)) {
    const availableModels = modelStore.availableVideoModels
    const isModelAvailable = availableModels.some(m => m.key === localModel.value)

    if (!localModel.value || !isModelAvailable) {
      localModel.value = modelStore.selectedVideoModel || availableModels[0]?.key || DEFAULT_VIDEO_MODEL
      updateNode(props.id, { model: localModel.value })
    }
  }
})

useNodeAutoHeight(props.id, [portalLoading, hasPortalWorkflow])

// Watch for model changes from props | 监听 props 中模型变化
watch(() => props.data?.model, (newModel) => {
  if (newModel && newModel !== localModel.value) {
    localModel.value = newModel
  }
})

// 修复 Vue Flow visibility: hidden 问题
// 当节点数据变化时，强制更新内部状态
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
.video-config-node-wrapper {
  position: relative;
}

.video-config-node {
  cursor: default;
  position: relative;
}
</style>