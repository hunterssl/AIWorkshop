<template>
  <Teleport to="body">
    <Transition name="cs-wf-panel-slide">
      <div v-if="visible" class="cs-wf-panel-root">
        <div class="cs-wf-panel-backdrop" @click="visible = false" />
        <div class="cs-wf-panel">
          <div class="cs-wf-panel-header">
            <div class="cs-wf-panel-tabs">
              <span
                class="cs-wf-tab-item"
                :class="{ active: activeTab === 'public' }"
                @click="activeTab = 'public'"
              >公共工作流</span>
              <span
                class="cs-wf-tab-item"
                :class="{ active: activeTab === 'apps' }"
                @click="activeTab = 'apps'"
              >应用中心</span>
            </div>
            <button class="cs-wf-close-btn" type="button" @click="visible = false">
              <n-icon :size="16"><CloseOutline /></n-icon>
            </button>
          </div>

          <div class="cs-wf-panel-toolbar">
            <div class="cs-wf-search-wrap">
              <n-icon :size="16" class="cs-wf-search-icon"><SearchOutline /></n-icon>
              <input
                v-model="searchQuery"
                type="search"
                class="cs-wf-search-input"
                :placeholder="activeTab === 'apps' ? '搜索应用名称…' : '搜索工作流名称…'"
              />
              <button
                v-if="searchQuery"
                type="button"
                class="cs-wf-search-clear"
                @click="searchQuery = ''"
              >
                <n-icon :size="14"><CloseOutline /></n-icon>
              </button>
            </div>
            <div class="cs-wf-filter-row">
              <button
                v-for="option in activeCategoryOptions"
                :key="option.key"
                type="button"
                class="cs-wf-filter-chip"
                :class="{ active: activeCategory === option.key }"
                @click="activeCategory = option.key"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="cs-wf-panel-body">
            <div v-if="activeTab === 'public'" class="cs-wf-grid">
              <div v-if="filteredPublicWorkflows.length === 0" class="cs-wf-empty cs-wf-empty--inline">
                <p class="text-sm">没有匹配的工作流</p>
                <p class="text-xs mt-1">试试换个关键词或分类</p>
              </div>
              <div
                v-for="workflow in filteredPublicWorkflows"
                :key="workflow.id"
                class="cs-wf-card"
                @click="handleAddWorkflow(workflow)"
              >
                <div class="cs-wf-card-cover">
                  <img v-if="workflow.cover" :src="workflow.cover" :alt="workflow.name" class="cs-wf-cover-img" />
                  <n-icon v-else :size="36" class="cs-wf-cover-icon">
                    <component :is="getIcon(workflow.icon)" />
                  </n-icon>
                </div>
                <div class="cs-wf-card-title">{{ workflow.name }}</div>
              </div>
            </div>

            <template v-else>
              <div v-if="loadingApps" class="cs-wf-empty">
                <p class="text-sm">正在加载应用中心...</p>
              </div>
              <div v-else-if="portalApps.length === 0" class="cs-wf-empty">
                <n-icon :size="36" class="text-gray-500">
                  <AppsOutline />
                </n-icon>
                <p class="text-gray-500 text-sm mt-2">暂无已发布应用</p>
                <p class="text-gray-500 text-xs mt-1">请先在 ComfyUI 中发布工作流应用</p>
              </div>
              <div v-else class="cs-wf-grid">
                <div v-if="filteredPortalApps.length === 0" class="cs-wf-empty cs-wf-empty--inline">
                  <p class="text-sm">没有匹配的应用</p>
                  <p class="text-xs mt-1">试试换个关键词或分类</p>
                </div>
                <div
                  v-for="app in filteredPortalApps"
                  :key="app.id"
                  class="cs-wf-card"
                  @click="handleAddPortalApp(app)"
                >
                  <div class="cs-wf-card-cover">
                    <img v-if="app.cover_url" :src="app.cover_url" :alt="app.name" class="cs-wf-cover-img" />
                    <n-icon v-else :size="36" class="cs-wf-cover-icon">
                      <AppsOutline />
                    </n-icon>
                  </div>
                  <div class="cs-wf-card-title">{{ app.name || app.id }}</div>
                  <div class="cs-wf-card-meta">{{ getPortalAppModeLabel(app.studio_modes, app) }}</div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'
import {
  CloseOutline,
  GridOutline,
  ImageOutline,
  VideocamOutline,
  BookOutline,
  PersonOutline,
  CartOutline,
  ChatbubbleOutline,
  AppsOutline,
  SearchOutline,
} from '@vicons/ionicons5'
import { WORKFLOW_TEMPLATES } from '../config/workflows'
import { getPortalAppModeLabel, listPortalApps } from '../api/portal'

const props = defineProps({
  show: Boolean,
})

const emit = defineEmits(['update:show', 'add-workflow', 'add-portal-app'])

const activeTab = ref('public')
const portalApps = ref([])
const loadingApps = ref(false)
const appsLoaded = ref(false)
const searchQuery = ref('')
const activeCategory = ref('all')

const APP_CATEGORY_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 't2i', label: '文生图' },
  { key: 'i2i', label: '图生图' },
  { key: 't2v', label: '文生视频' },
  { key: 'i2v', label: '图生视频' },
  { key: 'workflow', label: '工作流' },
]

const PUBLIC_CATEGORY_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'storyboard', label: '分镜' },
  { key: 'ecommerce', label: '电商' },
  { key: 'drama', label: '短剧' },
  { key: 'creative', label: '创意' },
]

const PUBLIC_CATEGORY_LABELS = {
  storyboard: '分镜',
  ecommerce: '电商',
  drama: '短剧',
  creative: '创意',
}

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

const publicWorkflows = computed(() => WORKFLOW_TEMPLATES)

const activeCategoryOptions = computed(() =>
  activeTab.value === 'apps' ? APP_CATEGORY_OPTIONS : PUBLIC_CATEGORY_OPTIONS
)

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase()
}

function matchesSearch(...fields) {
  const query = normalizeSearchText(searchQuery.value)
  if (!query) return true
  return fields.some((field) => normalizeSearchText(field).includes(query))
}

function resolveAppModeKey(app) {
  const modes = Array.isArray(app?.studio_modes) ? app.studio_modes : []
  if (modes.includes('t2i')) return 't2i'
  if (modes.includes('i2i')) return 'i2i'
  if (modes.includes('t2v')) return 't2v'
  if (modes.includes('i2v')) return 'i2v'
  const label = getPortalAppModeLabel(modes, app)
  if (label === '文生图') return 't2i'
  if (label === '图生图') return 'i2i'
  if (label === '文生视频') return 't2v'
  if (label === '图生视频') return 'i2v'
  return 'workflow'
}

const filteredPublicWorkflows = computed(() => {
  return publicWorkflows.value.filter((workflow) => {
    const category = workflow.category || 'creative'
    if (activeCategory.value !== 'all' && category !== activeCategory.value) {
      return false
    }
    const categoryLabel = PUBLIC_CATEGORY_LABELS[category] || category
    return matchesSearch(workflow.name, workflow.description, categoryLabel)
  })
})

const filteredPortalApps = computed(() => {
  return portalApps.value.filter((app) => {
    const modeKey = resolveAppModeKey(app)
    if (activeCategory.value !== 'all' && modeKey !== activeCategory.value) {
      return false
    }
    const modeLabel = getPortalAppModeLabel(app.studio_modes, app)
    return matchesSearch(app.name, app.id, modeLabel)
  })
})

const iconMap = {
  GridOutline,
  ImageOutline,
  VideocamOutline,
  BookOutline,
  PersonOutline,
  ShoppingOutline: CartOutline,
  ChatbubbleOutline,
}

const getIcon = (iconName) => iconMap[iconName] || GridOutline

const loadPortalApps = async () => {
  if (loadingApps.value) return
  loadingApps.value = true
  try {
    portalApps.value = await listPortalApps()
    appsLoaded.value = true
  } catch (err) {
    window.$message?.error(err?.message || '加载应用中心失败')
    portalApps.value = []
  } finally {
    loadingApps.value = false
  }
}

watch(() => props.show, (show) => {
  if (show && !appsLoaded.value) {
    loadPortalApps()
  }
  if (!show) {
    searchQuery.value = ''
    activeCategory.value = 'all'
  }
})

watch(activeTab, (tab) => {
  activeCategory.value = 'all'
  searchQuery.value = ''
  if (tab === 'apps' && props.show && !appsLoaded.value) {
    loadPortalApps()
  }
})

const handleAddWorkflow = (workflow) => {
  emit('add-workflow', { workflow, options: {} })
  visible.value = false
}

const handleAddPortalApp = (app) => {
  emit('add-portal-app', app)
  visible.value = false
}
</script>

<style>
.cs-wf-panel-root {
  position: fixed;
  inset: 0;
  z-index: 2000;
  pointer-events: none;
}

.cs-wf-panel-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: auto;
}

.cs-wf-panel {
  position: absolute;
  left: 72px;
  top: 88px;
  width: 520px;
  max-height: calc(100vh - 108px);
  background: var(--bg-secondary);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.cs-wf-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.cs-wf-panel-tabs {
  display: flex;
  gap: 24px;
}

.cs-wf-tab-item {
  font-size: 15px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
  padding-bottom: 4px;
  user-select: none;
}

.cs-wf-tab-item:hover {
  color: var(--text-primary);
}

.cs-wf-tab-item.active {
  color: var(--text-primary);
  font-weight: 500;
}

.cs-wf-close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.cs-wf-close-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.cs-wf-panel-toolbar {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cs-wf-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.cs-wf-search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-secondary);
  pointer-events: none;
}

.cs-wf-search-input {
  width: 100%;
  height: 36px;
  padding: 0 36px 0 36px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.cs-wf-search-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.cs-wf-search-input::placeholder {
  color: var(--text-secondary);
}

.cs-wf-search-clear {
  position: absolute;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.cs-wf-search-clear:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.cs-wf-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cs-wf-filter-chip {
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.2s;
}

.cs-wf-filter-chip:hover {
  color: var(--text-primary);
  border-color: var(--accent-color);
}

.cs-wf-filter-chip.active {
  background: rgba(99, 102, 241, 0.16);
  border-color: var(--accent-color);
  color: var(--text-primary);
  font-weight: 500;
}

.cs-wf-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 0;
}

.cs-wf-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.cs-wf-card {
  cursor: pointer;
  transition: transform 0.2s;
  min-width: 0;
}

.cs-wf-card:hover {
  transform: translateY(-2px);
}

.cs-wf-card:hover .cs-wf-card-cover {
  border-color: var(--accent-color);
}

.cs-wf-card-cover {
  aspect-ratio: 1;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  transition: border-color 0.2s;
  overflow: hidden;
}

.cs-wf-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cs-wf-cover-icon {
  color: var(--text-secondary);
}

.cs-wf-card-title {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-primary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cs-wf-card-meta {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
}

.cs-wf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
  color: var(--text-secondary);
}

.cs-wf-empty--inline {
  grid-column: 1 / -1;
  padding: 40px 16px;
}

.cs-wf-panel-slide-enter-active,
.cs-wf-panel-slide-leave-active {
  transition: opacity 0.25s ease;
}

.cs-wf-panel-slide-enter-active .cs-wf-panel,
.cs-wf-panel-slide-leave-active .cs-wf-panel {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.cs-wf-panel-slide-enter-from,
.cs-wf-panel-slide-leave-to {
  opacity: 0;
}

.cs-wf-panel-slide-enter-from .cs-wf-panel,
.cs-wf-panel-slide-leave-to .cs-wf-panel {
  opacity: 0;
  transform: translateX(-12px);
}

.cs-wf-panel-body::-webkit-scrollbar {
  width: 6px;
}

.cs-wf-panel-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}
</style>
