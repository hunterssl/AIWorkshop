<template>
  <!-- Workflow panel | 工作流浮动面板 -->
  <Transition name="panel-slide">
    <div v-if="visible" class="workflow-panel" v-click-outside="handleClickOutside">
      <!-- Header | 头部 -->
      <div class="panel-header">
        <div class="panel-tabs">
          <span class="tab-item active">应用中心</span>
        </div>
        <button class="expand-btn" @click="visible = false">
          <n-icon :size="16"><CloseOutline /></n-icon>
        </button>
      </div>
      
      <!-- Content | 内容 -->
      <div class="panel-content">
        <div v-if="loadingApps" class="empty-state">
          <p class="text-sm">正在加载应用中心...</p>
        </div>
        <div v-else-if="portalApps.length === 0" class="empty-state">
          <n-icon :size="36" class="text-gray-500">
            <AppsOutline />
          </n-icon>
          <p class="text-gray-500 text-sm mt-2">暂无已发布应用</p>
          <p class="text-gray-500 text-xs mt-1">请先在 ComfyUI 中发布工作流应用</p>
        </div>
        <div v-else class="workflow-grid">
          <div
            v-for="app in portalApps"
            :key="app.id"
            class="workflow-card"
            @click="handleAddPortalApp(app)"
          >
            <div class="card-cover">
              <img v-if="app.cover_url" :src="app.cover_url" :alt="app.name" class="cover-img" />
              <n-icon v-else :size="36" class="cover-icon">
                <AppsOutline />
              </n-icon>
            </div>
            <div class="card-title">{{ app.name || app.id }}</div>
            <div class="card-meta">{{ getPortalAppModeLabel(app.studio_modes, app) }}</div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
/**
 * Workflow Panel Component | 工作流面板组件
 * 显示工作流模板列表，支持一键添加到画布
 */
import { computed, ref, watch, onMounted } from 'vue'
import { NIcon } from 'naive-ui'
import { CloseOutline, AppsOutline } from '@vicons/ionicons5'
import { getPortalAppModeLabel, listPortalApps } from '../api/portal'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['update:show', 'add-portal-app'])

const portalApps = ref([])
const loadingApps = ref(false)
const appsLoaded = ref(false)

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

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
  if (show) {
    loadPortalApps()
  }
})

onMounted(() => {
  loadPortalApps()
})

const handleAddPortalApp = (app) => {
  emit('add-portal-app', app)
  visible.value = false
}

const handleClickOutside = () => {
  visible.value = false
}

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      if (!el.contains(e.target)) {
        binding.value()
      }
    }
    setTimeout(() => {
      document.addEventListener('click', el._clickOutside)
    }, 0)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside)
  }
}
</script>

<style scoped>
.workflow-panel {
  position: fixed;
  left: 72px;
  top: 100px;
  width: 520px;
  max-height: 70vh;
  background: var(--bg-secondary);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 100;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:global(.dark) .workflow-panel {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color);
}

.panel-tabs {
  display: flex;
  gap: 24px;
}

.tab-item {
  font-size: 15px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
  padding-bottom: 4px;
}

.tab-item:hover {
  color: var(--text-primary);
}

.tab-item.active {
  color: var(--text-primary);
  font-weight: 500;
}

.expand-btn {
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

.expand-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.workflow-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.workflow-card:hover {
  transform: translateY(-2px);
}

.workflow-card:hover .card-cover {
  border-color: var(--accent-color);
}

.card-cover {
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

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-icon {
  color: var(--text-secondary);
}

.card-title {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-primary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
  color: var(--text-secondary);
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.25s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>
