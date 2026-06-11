<template>
  <!-- Canvas page | 画布页面 -->
  <div class="studio-canvas-page h-screen w-screen flex flex-col">
    <!-- Header | 顶部导航 -->
    <AppHeader class="bg-[var(--bg-secondary)]">
      <template #left>
        <button 
          @click="goBack"
          class="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
        >
          <n-icon :size="20"><ChevronBackOutline /></n-icon>
        </button>
        <n-dropdown :options="projectOptions" @select="handleProjectAction">
          <button class="flex items-center gap-1 hover:bg-[var(--bg-tertiary)] px-2 py-1 rounded-lg transition-colors">
            <span class="font-medium">{{ projectName }}</span>
            <n-icon :size="16"><ChevronDownOutline /></n-icon>
          </button>
        </n-dropdown>
      </template>
      <template #right>
        <button 
          type="button"
          @click="showDownloadModal = true"
          class="rh-header-icon-btn"
          :class="{ 'is-active': hasDownloadableAssets }"
          title="批量下载素材"
          aria-label="批量下载素材"
        >
          <n-icon :size="20"><DownloadOutline /></n-icon>
        </button>
      </template>
    </AppHeader>

    <!-- Main canvas area | 主画布区域 -->
    <div ref="canvasContainer" class="flex-1 relative overflow-hidden">
      <!-- Vue Flow canvas | Vue Flow 画布 -->
      <VueFlow
        :key="flowKey"
        v-model:nodes="nodes"
        v-model:edges="edges"
        v-model:viewport="viewport"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :default-viewport="canvasViewport"
        :min-zoom="0.1"
        :max-zoom="2"
        :zoom-on-double-click="false"
        :snap-to-grid="true"
        :snap-grid="[20, 20]"
        :elements-selectable="false"
        :is-valid-connection="isValidConnection"
        @connect="onConnect"
        @edge-click="onEdgeClick"
        @node-click="onNodeClick"
        @pane-click="onPaneClick"
        @viewport-change="handleViewportChange"
        @edges-change="onEdgesChange"
        @node-drag-stop="onNodeDragStop"
        @dblclick="onPaneDblClick"
        class="canvas-flow"
      >
        <Background v-if="showGrid" :gap="20" :size="1" />
        <MiniMap
          v-if="!isMobile && showMiniMap"
          position="bottom-right"
          :pannable="true"
          :zoomable="true"
          :node-color="miniMapNodeColor"
          :node-stroke-color="miniMapNodeStrokeColor"
          :mask-color="miniMapMaskColor"
          :mask-stroke-color="miniMapMaskStrokeColor"
          :mask-stroke-width="miniMapMaskStrokeWidth"
          class="canvas-minimap"
        />
      </VueFlow>

      <!-- Left toolbar | 左侧工具栏 -->
      <aside class="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-lg z-10">
        <button 
          @click="toggleNodeMenu"
          class="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)] transition-colors"
          title="添加节点"
        >
          <n-icon :size="20"><AddOutline /></n-icon>
        </button>
        <button 
          @click="showWorkflowPanel = true"
          class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
          title="工作流 / 应用中心"
        >
          <n-icon :size="20"><AppsOutline /></n-icon>
        </button>
        <button 
          @click="showVirtualImagePanel = true"
          class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
          title="虚拟人像库"
        >
          <n-icon :size="20"><GridOutline /></n-icon>
        </button>
        <div class="w-full h-px bg-[var(--border-color)] my-1"></div>
        <button 
          v-for="tool in tools" 
          :key="tool.id"
          @click="tool.action"
          :disabled="tool.disabled && tool.disabled()"
          class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          :title="tool.name"
        >
          <n-icon :size="20"><component :is="tool.icon" /></n-icon>
        </button>
      </aside>

      <!-- Node menu popup | 节点菜单弹窗（双击画布或点击工具栏按钮打开） -->
      <div 
        v-if="showNodeMenu"
        class="fixed bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-lg p-2 z-50"
        :style="menuStyle"
      >
        <button 
          v-for="nodeType in nodeTypeOptions" 
          :key="nodeType.type"
          @click="addNewNode(nodeType.type)"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-left"
        >
          <n-icon :size="20" :color="nodeType.color"><component :is="nodeType.icon" /></n-icon>
          <span class="text-sm">{{ nodeType.name }}</span>
        </button>
      </div>

      <!-- Bottom controls | 底部控制 -->
      <div class="absolute bottom-4 left-4 flex items-center gap-1 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-1">
        <button 
          @click="fitView({ padding: 0.2 })" 
          class="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          title="适应视图"
        >
          <n-icon :size="16"><LocateOutline /></n-icon>
        </button>
        <div class="w-px h-6 bg-[var(--border-color)]"></div>
        <div class="flex items-center gap-1 px-2">
          <button @click="zoomOut" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14"><RemoveOutline /></n-icon>
          </button>
          <span class="text-xs min-w-[40px] text-center">{{ Math.round(viewport.zoom * 100) }}%</span>
          <button @click="zoomIn" class="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors">
            <n-icon :size="14"><AddOutline /></n-icon>
          </button>
        </div>
        <template v-if="!isMobile">
          <div class="w-px h-6 bg-[var(--border-color)]"></div>
          <button
            type="button"
            class="p-2 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            :class="{ 'text-[var(--accent-color)] bg-[var(--bg-tertiary)]': showMiniMap }"
            :title="showMiniMap ? '隐藏小地图' : '显示小地图'"
            @click="toggleMiniMap"
          >
            <n-icon :size="16"><MapOutline /></n-icon>
          </button>
        </template>
      </div>
    </div>

    <n-modal v-model:show="showRenameModal" preset="dialog" title="重命名项目">
      <n-input v-model:value="renameValue" placeholder="请输入项目名称" />
      <template #action><n-button @click="showRenameModal = false">取消</n-button><n-button type="primary" @click="confirmRename">确定</n-button></template>
    </n-modal>
    <n-modal v-model:show="showDeleteModal" preset="dialog" title="删除项目" type="warning">
      <p>确定要删除项目「{{ projectName }}」吗？此操作不可恢复。</p>
      <template #action><n-button @click="showDeleteModal = false">取消</n-button><n-button type="error" @click="confirmDelete">删除</n-button></template>
    </n-modal>
    <DownloadModal v-model:show="showDownloadModal" />
    <WorkflowPanel v-model:show="showWorkflowPanel" @add-workflow="handleAddWorkflow" @add-portal-app="handleAddPortalApp" />
    <VirtualImagePanel v-model:show="showVirtualImagePanel" @add-virtualimage="handleAddVirtualimage" @add-virtualimages="handleAddVirtualimages" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, markRaw } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { NIcon, NDropdown, NModal, NInput, NButton } from 'naive-ui'
import { ChevronBackOutline, ChevronDownOutline, AddOutline, ImageOutline, TextOutline, VideocamOutline, ColorPaletteOutline, ArrowUndoOutline, ArrowRedoOutline, GridOutline, LocateOutline, RemoveOutline, DownloadOutline, AppsOutline, ChatbubbleOutline, GitNetworkOutline, MapOutline } from '@vicons/ionicons5'
import { nodes, edges, addNode, addNodes, addEdge, addEdges, removeNode, updateNode, getNodeRight, getNodeBottom, initSampleData, loadProject, saveProject, clearCanvas, canvasViewport, updateViewport, undo, redo, canUndo, canRedo, manualSaveHistory, startBatchOperation, endBatchOperation } from '../stores/canvas'
import { loadAllModels } from '../stores/models'
import { projects, initProjectsStore, updateProject, renameProject, currentProject } from '../stores/projects'
import DownloadModal from '../components/DownloadModal.vue'
import { getPortalApp, resolvePortalAppNodeType } from '../api/portal'
import { buildDefaultParamValues, buildPortalInputNodeSpec, getInputParams, rememberPortalApp, resolveDefaultPortalApp } from '../hooks/usePortalWorkflow'
import WorkflowPanel from '@/components/WorkflowPanel.vue'
import AppHeader from '@/components/AppHeader.vue'
import TextNode from '@/components/nodes/TextNode.vue'
import ImageConfigNode from '@/components/nodes/ImageConfigNode.vue'
import PortalComfyConfigNode from '@/components/nodes/PortalComfyConfigNode.vue'
import VideoNode from '@/components/nodes/VideoNode.vue'
import ImageNode from '@/components/nodes/ImageNode.vue'
import VideoConfigNode from '@/components/nodes/VideoConfigNode.vue'
import LLMConfigNode from '@/components/nodes/LLMConfigNode.vue'
import ImageRoleEdge from '@/components/edges/ImageRoleEdge.vue'
import PromptOrderEdge from '@/components/edges/PromptOrderEdge.vue'
import ImageOrderEdge from '@/components/edges/ImageOrderEdge.vue'
import DefaultFlowEdge from '@/components/edges/DefaultFlowEdge.vue'
import VirtualImagePanel from '@/components/VirtualImagePanel.vue'
import { isDark } from '../stores/theme'

const MINIMAP_STORAGE_KEY = 'canvas-show-minimap'

onMounted(() => { loadAllModels() })

const router = useRouter()
const route = useRoute()
const { viewport, zoomIn, zoomOut, fitView, setCenter, updateNodeInternals } = useVueFlow()

const onNodeDragStop = ({ node }) => {}

const applyNodeSelection = (targetId, { append = false } = {}) => {
  nodes.value = nodes.value.map((n) => {
    const shouldSelect = append ? !!(n.data?.selected || n.id === targetId) : n.id === targetId
    if (n.selected === shouldSelect && !!n.data?.selected === shouldSelect) return n
    return {
      ...n,
      selected: shouldSelect,
      data: { ...n.data, selected: shouldSelect },
    }
  })
}

const clearNodeSelection = () => {
  nodes.value = nodes.value.map((n) => {
    if (!n.selected && !n.data?.selected) return n
    return {
      ...n,
      selected: false,
      data: { ...n.data, selected: false },
    }
  })
}

const onNodeClick = ({ node, event }) => {
  applyNodeSelection(node.id, { append: event.shiftKey })
}

const baseNodeTypes = {
  text: markRaw(TextNode),
  imageConfig: markRaw(ImageConfigNode),
  video: markRaw(VideoNode),
  image: markRaw(ImageNode),
  videoConfig: markRaw(VideoConfigNode),
  llmConfig: markRaw(LLMConfigNode),
}
const portalNodeTypes = {
  portalComfyConfig: markRaw(PortalComfyConfigNode),
  portalImageConfig: markRaw(PortalComfyConfigNode),
  portalVideoConfig: markRaw(PortalComfyConfigNode),
}
const nodeTypes = {
  ...baseNodeTypes,
  ...portalNodeTypes,
}
const edgeTypes = {
  default: markRaw(DefaultFlowEdge),
  imageRole: markRaw(ImageRoleEdge),
  promptOrder: markRaw(PromptOrderEdge),
  imageOrder: markRaw(ImageOrderEdge),
}

const showNodeMenu = ref(false)
const canvasContainer = ref(null)
const dblClickFlowPos = ref(null)
const menuScreenPos = ref(null)
const isMobile = ref(false)
const showGrid = ref(false)
const flowKey = ref(Date.now())
const showRenameModal = ref(false)
const showDeleteModal = ref(false)
const showDownloadModal = ref(false)
const showWorkflowPanel = ref(false)
const showVirtualImagePanel = ref(false)
const renameValue = ref('')
const showMiniMap = ref(localStorage.getItem(MINIMAP_STORAGE_KEY) !== '0')

const miniMapNodeColor = computed(() => (isDark.value ? '#475569' : '#cbd5e1'))
const miniMapNodeStrokeColor = computed(() => (isDark.value ? '#94a3b8' : '#64748b'))
const miniMapMaskColor = computed(() => (isDark.value ? 'rgba(2, 8, 23, 0.62)' : 'rgba(15, 23, 42, 0.28)'))
const miniMapMaskStrokeColor = computed(() => (isDark.value ? '#7dd3fc' : '#7c3aed'))
const miniMapMaskStrokeWidth = computed(() => (isDark.value ? 2.5 : 2))

const toggleMiniMap = () => {
  showMiniMap.value = !showMiniMap.value
  localStorage.setItem(MINIMAP_STORAGE_KEY, showMiniMap.value ? '1' : '0')
}

const hasDownloadableAssets = computed(() => nodes.value.some(n => (n.type === 'image' || n.type === 'video') && n.data?.url))
const projectName = computed(() => { const p = projects.value.find(p => p.id === route.params.id); return p?.name || '未命名项目' })
const projectOptions = [{ label: '重命名', key: 'rename' }, { label: '复制', key: 'duplicate' }, { label: '删除', key: 'delete' }]
const tools = computed(() => [
  { id: 'text', name: '文本', icon: TextOutline, action: () => addNewNode('text') },
  { id: 'image', name: '图片', icon: ImageOutline, action: () => addNewNode('image') },
  { id: 'imageConfig', name: '文生图', icon: ColorPaletteOutline, action: () => addNewNode('imageConfig') },
  { id: 'videoConfig', name: '视频生成', icon: VideocamOutline, action: () => addNewNode('videoConfig') },
  { id: 'portalComfyConfig', name: 'ComfyUI', icon: GitNetworkOutline, action: () => addNewNode('portalComfyConfig') },
  { id: 'undo', name: '撤销', icon: ArrowUndoOutline, action: () => undo(), disabled: () => !canUndo() },
  { id: 'redo', name: '重做', icon: ArrowRedoOutline, action: () => redo(), disabled: () => !canRedo() },
])
const portalNodeTypeOptions = [
  { type: 'portalComfyConfig', name: 'ComfyUI', icon: GitNetworkOutline, color: '#22c55e' },
]
const baseNodeTypeOptions = [
  { type: 'text', name: '文本节点', icon: TextOutline, color: '#3b82f6' },
  { type: 'llmConfig', name: 'LLM文本生成', icon: ChatbubbleOutline, color: '#a855f7' },
  { type: 'imageConfig', name: '文生图配置', icon: ColorPaletteOutline, color: '#22c55e' },
  { type: 'videoConfig', name: '视频生成配置', icon: VideocamOutline, color: '#f59e0b' },
  { type: 'image', name: '图片节点', icon: ImageOutline, color: '#8b5cf6' },
  { type: 'video', name: '视频节点', icon: VideocamOutline, color: '#ef4444' },
]
const nodeTypeOptions = computed(() => [
  ...baseNodeTypeOptions,
  ...portalNodeTypeOptions,
])
const menuStyle = computed(() => {
  if (!menuScreenPos.value) return { left: '80px', top: '50%', transform: 'translateY(-50%)' }
  const { x, y } = menuScreenPos.value
  const vw = window.innerWidth
  const vh = window.innerHeight
  const menuW = 180
  const menuH = 280
  let left = x + 12
  let top = y - 20
  if (left + menuW > vw) left = x - menuW - 12
  if (top + menuH > vh) top = y - menuH + 20
  if (top < 0) top = 8
  return { left: `${left}px`, top: `${top}px` }
})

// ========== 基于节点四角坐标的布局方法 ==========
const getHorizontalPosition = (count = 1) => {
  const existing = nodes.value || []
  const gap = 40; const startX = 100; const startY = 100
  if (existing.length === 0) return Array.from({ length: count }, (_, i) => ({ x: startX + i * 300, y: startY }))
  let maxRight = -Infinity; let avgY = 0
  for (const n of existing) { const right = getNodeRight(n); if (right > maxRight) maxRight = right; avgY += (n.position?.y ?? 0) }
  avgY /= existing.length
  const positions = []
  for (let i = 0; i < count; i++) positions.push({ x: maxRight + gap + i * 300, y: avgY })
  return positions
}
const getVerticalPosition = (count = 1) => {
  const existing = nodes.value || []
  const gap = 60; const startX = 100; const startY = 100
  if (existing.length === 0) return Array.from({ length: count }, (_, i) => ({ x: startX, y: startY + i * 400 }))
  let maxBottom = -Infinity; let avgX = 0
  for (const n of existing) { const bottom = getNodeBottom(n); if (bottom > maxBottom) maxBottom = bottom; avgX += (n.position?.x ?? 0) }
  avgX /= existing.length
  const positions = []
  for (let i = 0; i < count; i++) positions.push({ x: avgX, y: maxBottom + gap + i * 400 })
  return positions
}

const NODE_DIMS = {
  text: { width: 320, height: 200 },
  imageConfig: { width: 360, height: 500 },
  videoConfig: { width: 360, height: 400 },
  image: { width: 300, height: 450 },
  video: { width: 300, height: 350 },
  llmConfig: { width: 360, height: 500 },
  portalComfyConfig: { width: 360, height: 500 },
}

const panToNodes = (nodeIds, options = {}) => {
  const { duration = 300, zoom } = options
  const targetZoom = zoom ?? viewport.value.zoom
  if (!nodeIds || nodeIds.length === 0) return

  const targetNodes = nodes.value.filter(n => nodeIds.includes(n.id))
  if (targetNodes.length === 0) return

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  targetNodes.forEach(node => {
    const dims = NODE_DIMS[node.type] || { width: 250, height: 250 }
    const w = node.width || dims.width
    const h = node.height || dims.height
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + w)
    maxY = Math.max(maxY, node.position.y + h)
  })

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  setCenter(cx, cy, { zoom: targetZoom, duration })
}

const addNewNode = async (type) => {
  const pos = dblClickFlowPos.value || getHorizontalPosition(1)[0]
  dblClickFlowPos.value = null
  menuScreenPos.value = null
  const defaultData = type === 'portalComfyConfig' ? { label: 'ComfyUI' } : {}
  const nodeId = addNode(type, pos, defaultData)
  const maxZIndex = Math.max(0, ...nodes.value.map(n => n.zIndex || 0))
  updateNode(nodeId, { zIndex: maxZIndex + 1 })
  setTimeout(() => updateNodeInternals(nodeId), 50)
  showNodeMenu.value = false
  setTimeout(() => panToNodes([nodeId], { duration: 300 }), 150)
}

const handleAddWorkflow = ({ workflow, options }) => {
  const vpCenterX = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
  const vpCenterY = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
  const startPos = { x: vpCenterX - 300, y: vpCenterY - 200 }
  const { nodes: newNodes, edges: newEdges } = workflow.createNodes(startPos, options)
  startBatchOperation()
  const nodeIds = addNodes(newNodes.map(n => ({ type: n.type, position: n.position, data: n.data })), false)
  const idMap = {}; newNodes.forEach((n, i) => { idMap[n.id] = nodeIds[i] })
  addEdges(newEdges.map(e => ({ source: idMap[e.source] || e.source, target: idMap[e.target] || e.target, sourceHandle: e.sourceHandle || 'right', targetHandle: e.targetHandle || 'left', type: e.type, data: e.data })), false)
  endBatchOperation()
  // 选中所有新添加的工作流节点 | Select all newly added workflow nodes
  nodeIds.forEach(nid => updateNode(nid, { selected: true }))
  setTimeout(() => {
    nodeIds.forEach(nid => updateNodeInternals(nid))
    panToNodes(nodeIds, { duration: 300 })
  }, 100)
  window.$message?.success(`已添加工作流: ${workflow.name}`)
}

const handleAddPortalApp = async (app) => {
  if (!app?.id) {
    window.$message?.warning('应用数据无效')
    return
  }

  let manifest = null
  try {
    manifest = await getPortalApp(app.id)
  } catch (err) {
    window.$message?.error(err?.message || '加载应用详情失败')
    return
  }

  const inputParams = getInputParams(manifest)
  const { workflowMode } = resolvePortalAppNodeType(manifest?.studio_modes || app.studio_modes)
  const appName = app.name || manifest?.name || app.id
  const vpCenterX = -viewport.value.x / viewport.value.zoom + (window.innerWidth / 2) / viewport.value.zoom
  const vpCenterY = -viewport.value.y / viewport.value.zoom + (window.innerHeight / 2) / viewport.value.zoom
  const startPos = { x: vpCenterX - 300, y: vpCenterY - 200 }
  const INPUT_GAP = 320

  const inputNodeSpecs = inputParams.map((param, index) => {
    const y = startPos.y + index * INPUT_GAP
    return buildPortalInputNodeSpec(param, { x: startPos.x, y })
  })

  const configY = inputNodeSpecs.length > 1
    ? startPos.y + ((inputNodeSpecs.length - 1) * INPUT_GAP) / 2
    : startPos.y

  const nodesToAdd = [
    ...inputNodeSpecs,
    {
      type: 'portalComfyConfig',
      position: { x: startPos.x + 460, y: configY },
      data: {
        label: appName,
        workflowAppName: appName,
        workflowAppId: app.id,
        workflowMode,
        workflowParams: buildDefaultParamValues(manifest),
      },
    },
  ]

  startBatchOperation()
  const nodeIds = addNodes(nodesToAdd, false)
  const configNodeId = nodeIds[nodeIds.length - 1]
  const edgesToAdd = inputNodeSpecs.map((spec, index) => {
    const isImage = spec.type === 'image'
    return {
      source: nodeIds[index],
      target: configNodeId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: isImage ? 'imageOrder' : 'promptOrder',
      data: {
        portalParamKey: spec.data.portalParamKey,
        ...(isImage ? { imageOrder: index + 1 } : { promptOrder: index + 1 }),
      },
    }
  })
  if (edgesToAdd.length) {
    addEdges(edgesToAdd, false)
  }
  endBatchOperation()

  rememberPortalApp(app.id)
  nodeIds.forEach((nid) => updateNode(nid, { selected: true }))
  setTimeout(() => nodeIds.forEach((nid) => updateNodeInternals(nid)), 100)
  window.$message?.success(`已添加应用: ${appName}`)
}

const addLocalComfyPromptPair = async (content, position) => {
  const { x, y } = position
  const app = await resolveDefaultPortalApp()
  let manifest = null
  let appName = 'ComfyUI'
  let appId = ''
  let workflowMode = 't2i'

  if (app?.id) {
    manifest = await getPortalApp(app.id)
    appName = app.name || manifest?.name || app.id
    appId = app.id
    workflowMode = resolvePortalAppNodeType(manifest?.studio_modes || app.studio_modes).workflowMode
    rememberPortalApp(appId)
  }

  startBatchOperation()
  const textId = addNode('text', { x, y }, { content, label: '提示词' })
  const configId = addNode('portalComfyConfig', { x: x + 460, y }, {
    label: appName,
    workflowAppName: appName,
    workflowAppId: appId,
    workflowMode,
    workflowParams: manifest ? buildDefaultParamValues(manifest) : {},
  })
  addEdge({
    source: textId,
    target: configId,
    sourceHandle: 'right',
    targetHandle: 'left',
    type: 'promptOrder',
    data: { promptOrder: 1 },
  })
  endBatchOperation()
  setTimeout(() => {
    updateNodeInternals(textId)
    updateNodeInternals(configId)
  }, 50)

  if (!app?.id) {
    window.$message?.warning('已创建节点，请在 ComfyUI 节点中选择工作流')
  } else {
    window.$message?.success('已创建提示词和 ComfyUI 节点')
  }
}

const handleAddVirtualimage = ({ url, name }) => {
  const [pos] = getVerticalPosition(1)
  const nodeId = addNode('image', pos, { url: url || '', label: name })
  updateNode(nodeId, { zIndex: Math.max(0, ...nodes.value.map(n => n.zIndex || 0)) + 1 })
  setTimeout(() => {
    updateNodeInternals(nodeId)
    panToNodes([nodeId], { duration: 300 })
  }, 50)
  window.$message?.success(`已添加: ${name}`)
}

const handleAddVirtualimages = ({ covers, name }) => {
  const nodeIds = []; const gap = 60
  const [firstPos] = getVerticalPosition(1); let cy = firstPos.y
  covers.forEach((cover, i) => {
    const nid = addNode('image', { x: firstPos.x, y: cy }, { url: cover, label: `${name}-${i + 1}` })
    nodeIds.push(nid)
    const n = nodes.value.find(n => n.id === nid); cy += (n?.height || 450) + gap
    updateNode(nid, { zIndex: Math.max(0, ...nodes.value.map(n => n.zIndex || 0)) + 1 + i })
  })
  setTimeout(() => {
    nodeIds.forEach(nid => updateNodeInternals(nid))
    panToNodes(nodeIds, { duration: 300 })
  }, 50)
  window.$message?.success(`已添加 ${name} 全部图片`)
}

const onDeleteSelectedNodes = () => {
  const ids = nodes.value.filter(n => n.data?.selected).map(n => n.id)
  if (ids.length === 0) return
  ids.forEach(id => removeNode(id))
  window.$message?.success(`已删除 ${ids.length} 个节点`)
}

const isValidConnection = (connection) => {
  return connection.sourceHandle === 'right' && connection.targetHandle === 'left'
}

const onConnect = (params) => {
  if (!isValidConnection(params)) {
    nextTick(() => {
      edges.value = edges.value.filter(e =>
        !(e.source === params.source && e.target === params.target)
      )
    })
    return
  }
  const src = nodes.value.find(n => n.id === params.source)
  const tgt = nodes.value.find(n => n.id === params.target)
  const isImageConfigTarget = (type) => type === 'imageConfig' || type === 'portalImageConfig'
  const isVideoConfigTarget = (type) => type === 'videoConfig' || type === 'portalVideoConfig'
  const isPortalComfyTarget = (type) => type === 'portalComfyConfig' || type === 'portalImageConfig' || type === 'portalVideoConfig'

  if (src?.type === 'image' && tgt?.type === 'videoConfig') {
    addEdge({ ...params, type: 'imageRole', data: { imageRole: 'first_frame_image' } })
  } else if (src?.type === 'text' && (isImageConfigTarget(tgt?.type) || isPortalComfyTarget(tgt?.type))) {
    const n = edges.value.filter(e => e.target === params.target && e.type === 'promptOrder').length + 1
    const portalParamKey = src.data?.portalParamKey
    addEdge({
      ...params,
      type: 'promptOrder',
      data: { promptOrder: n, ...(portalParamKey ? { portalParamKey } : {}) },
    })
  } else if (src?.type === 'image' && (isImageConfigTarget(tgt?.type) || isPortalComfyTarget(tgt?.type))) {
    const ex = edges.value.filter(e => e.target === params.target && e.type === 'imageOrder')
    let mc = 0
    for (const e of edges.value.filter(e => e.target === params.target)) {
      const sn = nodes.value.find(n => n.id === e.source)
      if (sn?.type === 'text') {
        const m = sn.data?.content?.match(/@\[([^\]|]+)(?:\|([^\]]+))?\]/g); if (m) mc += m.length
      }
    }
    const portalParamKey = src.data?.portalParamKey
    addEdge({
      ...params,
      type: 'imageOrder',
      data: {
        imageOrder: ex.length + mc + 1,
        ...(portalParamKey ? { portalParamKey } : {}),
      },
    })
  } else if (src?.type === 'text' && isVideoConfigTarget(tgt?.type)) {
    const portalParamKey = src.data?.portalParamKey
    addEdge({
      ...params,
      type: 'promptOrder',
      data: { promptOrder: 1, ...(portalParamKey ? { portalParamKey } : {}) },
    })
  } else if (src?.type === 'image' && isVideoConfigTarget(tgt?.type)) {
    const portalParamKey = src.data?.portalParamKey
    addEdge({
      ...params,
      type: 'imageRole',
      data: {
        imageRole: 'input_reference',
        ...(portalParamKey ? { portalParamKey } : {}),
      },
    })
  } else if (src?.type === 'llmConfig' && (isImageConfigTarget(tgt?.type) || isPortalComfyTarget(tgt?.type))) {
    addEdge({ ...params, type: 'promptOrder', data: { promptOrder: edges.value.filter(e => e.target === params.target && e.type === 'promptOrder').length + 1 } })
  } else if (src?.type === 'llmConfig' && isVideoConfigTarget(tgt?.type)) {
    addEdge({ ...params, type: 'promptOrder', data: { promptOrder: 1 } })
  } else { addEdge(params) }
}

const onEdgeClick = ({ event, edge }) => {
  if (event.altKey) {
    event.preventDefault()
    edges.value = edges.value.filter(e => e.id !== edge.id)
    window.$message?.success('连线已断开')
  }
}

const handleViewportChange = (v) => updateViewport(v)
const onEdgesChange = (changes) => { if (changes.some(c => c.type === 'remove')) nextTick(() => manualSaveHistory()) }

const onPaneDblClick = (event) => {
  const target = event.target
  if (target.closest('.vue-flow__node') || target.closest('.vue-flow__edge') || target.closest('.vue-flow__handle')) return

  const container = canvasContainer.value
  if (!container) return

  const rect = container.getBoundingClientRect()
  const flowX = (event.clientX - rect.left - viewport.value.x) / viewport.value.zoom
  const flowY = (event.clientY - rect.top - viewport.value.y) / viewport.value.zoom
  dblClickFlowPos.value = { x: Math.round(flowX), y: Math.round(flowY) }
  menuScreenPos.value = { x: event.clientX, y: event.clientY }

  showNodeMenu.value = true
}

const toggleNodeMenu = () => {
  if (showNodeMenu.value) {
    showNodeMenu.value = false
    menuScreenPos.value = null
  } else {
    menuScreenPos.value = null
    showNodeMenu.value = true
  }
}

const onPaneClick = () => {
  showNodeMenu.value = false
  menuScreenPos.value = null
  clearNodeSelection()
}

const handleProjectAction = (key) => {
  if (key === 'rename') { renameValue.value = projectName.value; showRenameModal.value = true }
  else if (key === 'duplicate') window.$message?.info('复制功能开发中')
  else if (key === 'delete') showDeleteModal.value = true
}
const confirmRename = () => { if (renameValue.value.trim()) { renameProject(route.params.id, renameValue.value.trim()); window.$message?.success('已重命名') } showRenameModal.value = false }
const confirmDelete = () => { showDeleteModal.value = false; window.$message?.success('项目已删除'); router.push('/') }

const goBack = () => router.push('/')
const checkMobile = () => { isMobile.value = window.innerWidth < 768 }
const loadProjectById = (pid) => { flowKey.value = Date.now(); pid && pid !== 'new' ? loadProject(pid) : clearCanvas() }

const refreshAllNodeSizes = () => {
  nodes.value.forEach((n) => updateNode(n.id, { width: undefined, height: undefined }))
  nextTick(() => {
    nodes.value.forEach((n) => updateNodeInternals(n.id))
    setTimeout(() => nodes.value.forEach((n) => updateNodeInternals(n.id)), 100)
  })
}

watch(() => route.params.id, (nid, oid) => { if (nid && nid !== oid) { if (oid) saveProject(); loadProjectById(nid) } })

onMounted(() => {
  checkMobile(); window.addEventListener('resize', checkMobile)
  window.addEventListener('keydown', (e) => { if (e.key === 'Delete' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') onDeleteSelectedNodes() })
  initProjectsStore(); loadProjectById(route.params.id)
  setTimeout(refreshAllNodeSizes, 150)
  const ip = sessionStorage.getItem('ai-canvas-initial-prompt')
  if (ip) {
    sessionStorage.removeItem('ai-canvas-initial-prompt')
    nextTick(async () => {
      let my = 0
      if (nodes.value.length > 0) my = Math.max(...nodes.value.map(n => n.position.y))
      const pos = { x: 100, y: my + 200 }
      await addLocalComfyPromptPair(ip, pos)
    })
  }
})
onUnmounted(() => { window.removeEventListener('resize', checkMobile); saveProject() })
</script>

<style>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/minimap/dist/style.css';
.canvas-flow { width: 100%; height: 100%; }

/* Selection ring follows the inner card border, not an oversized vue-flow box */
.vue-flow__node.selected {
  box-shadow: none !important;
}

/* Node box = visible card size (ignore store defaults + wrapper padding) */
.vue-flow__node-text,
.vue-flow__node-image,
.vue-flow__node-video,
.vue-flow__node-llmConfig,
.vue-flow__node-imageConfig,
.vue-flow__node-videoConfig,
.vue-flow__node-portalComfyConfig,
.vue-flow__node-portalImageConfig,
.vue-flow__node-portalVideoConfig {
  height: auto !important;
  width: auto !important;
  overflow: visible !important;
}

.text-node-wrapper,
.image-node-wrapper,
.video-node-wrapper,
.llm-node-wrapper,
.image-config-node-wrapper,
.video-config-node-wrapper,
.portal-comfy-config-node-wrapper {
  padding: 0 !important;
}

.text-node-wrapper > .text-node,
.image-node-wrapper > .image-node,
.video-node-wrapper > .video-node,
.llm-node-wrapper > .llm-node,
.image-config-node-wrapper > .image-config-node,
.video-config-node-wrapper > .video-config-node,
.portal-comfy-config-node-wrapper > .portal-comfy-config-node {
  margin-top: 20px;
}

/* Minimap: theme-aware background */
.canvas-flow .vue-flow__minimap.canvas-minimap {
  bottom: 16px !important;
  right: 16px !important;
  background-color: var(--bg-secondary) !important;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.dark .canvas-flow .vue-flow__minimap.canvas-minimap {
  background-color: rgba(15, 30, 58, 0.96) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.canvas-flow .vue-flow__minimap-mask {
  pointer-events: none;
}

.dark .canvas-flow .vue-flow__minimap-mask {
  filter: drop-shadow(0 0 4px rgba(125, 211, 252, 0.85));
}
</style>
