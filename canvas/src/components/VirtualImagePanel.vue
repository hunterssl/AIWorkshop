<template>
  <!-- VirtualImage panel| 虚拟人像库浮动面板 -->
  <Transition name="panel-slide">
    <div v-if="visible" class="virtualimage-panel" v-click-outside="handleClickOutside">
      <!-- Header | 头部 -->
      <div class="panel-header">
        <div class="panel-top">
          <div class="panel-top-left">
            <button v-if="selectedProject" class="back-btn" @click="goBackToProjects">
              <n-icon :size="16"><ChevronBackOutline /></n-icon>
            </button>
            <span class="project-name">{{ selectedProject || '项目名称' }}</span>
          </div>
          <button class="expand-btn" @click="visible = false">
            <n-icon :size="16"><CloseOutline /></n-icon>
          </button>
        </div>
        <!-- Category tabs (only shown when a project is selected) -->
        <div v-if="selectedProject" class="panel-tabs">
          <span 
            class="tab-item" 
            :class="{ active: activeTab === 'role' }"
            @click="activeTab = 'role'"
          >角色</span>
          <span 
            class="tab-item" 
            :class="{ active: activeTab === 'scene' }"
            @click="activeTab = 'scene'"
          >场景</span>
          <span 
            class="tab-item" 
            :class="{ active: activeTab === 'prop' }"
            @click="activeTab = 'prop'"
          >道具</span>
          <span 
            class="tab-item" 
            :class="{ active: activeTab === 'reference' }"
            @click="activeTab = 'reference'"
          >参考</span>
        </div>
      </div>
      
      <!-- Content | 内容 -->
      <div class="panel-content">
        <!-- Project selection grid (shown when no project is selected) -->
        <div v-if="!selectedProject" class="virtualimage-grid grid-set">
          <div 
            v-for="proj in projects" 
            :key="proj.id"
            class="virtualimage-card"
            @click="selectProject(proj)"
          >
            <div class="card-cover">
              <img v-if="proj.icon" :src="proj.icon" :alt="proj.name" class="cover-img" />
              <n-icon v-else :size="36" class="cover-icon">
                <FolderOutline />
              </n-icon>
              <div class="card-overlay">
                <button class="view-btn" @click.stop="selectProject(proj)">进入</button>
              </div>
            </div>
            <div class="card-title">{{ proj.name }}</div>
          </div>
        </div>

        <!-- Category item grid (shown when a project is selected) -->
        <div v-else class="virtualimage-grid grid-set">
          <div 
            v-for="item in activeTemplates" 
            :key="item.id"
            class="virtualimage-card"
          >
            <div class="card-cover">
              <img v-if="item.covers && item.covers[0]" :src="item.covers[0]" :alt="item.name" class="cover-img" />
              <n-icon v-else :size="36" class="cover-icon">
                <component :is="getIcon(item.icon)" />
              </n-icon>
              <div class="card-overlay">
                <button class="view-btn" @click.stop="handleViewGroupImages(item)">查看</button>
                <button class="apply-btn" @click.stop="handleAddVirtualImages(item)">应用</button>
              </div>
            </div>
            <div class="card-title">{{ item.name }}</div>
          </div>
        </div>
      </div>
    </div>

  </Transition>

  <!-- Image gallery overlay | 图片画廊弹层 -->
  <div v-if="showGallery" class="gallery-overlay" v-click-outside="() => showGallery = false">
    <div class="gallery-content" @click.stop>
      <div class="gallery-header">
        <span class="gallery-title">{{ galleryTitle }}</span>
        <button class="expand-btn" @click="showGallery = false">
          <n-icon :size="16"><CloseOutline /></n-icon>
        </button>
      </div>
      <div class="gallery-grid">
        <div v-for="(cover, ci) in galleryImages" :key="ci" class="gallery-item">
          <div class="gallery-item-cover">
            <img :src="cover" :alt="galleryTitle + '-' + (ci + 1)" class="gallery-img" />
            <div class="gallery-item-overlay">
              <button class="gallery-preview-btn" @click.stop="handlePreview(cover)">预览</button>
              <button class="gallery-apply-btn" @click.stop="handleApplySingle(cover, galleryTitle, ci)">应用</button>
            </div>
          </div>
          <div class="gallery-item-name">{{ ci + 1 }}/{{ galleryImages.length }}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Preview modal | 预览大图弹层 -->
  <div v-if="showPreview" class="preview-overlay" @click="showPreview = false">
    <div class="preview-content" @click.stop>
      <button class="preview-close" @click="showPreview = false">
        <n-icon :size="24"><CloseOutline /></n-icon>
      </button>
      <img :src="previewImage" class="preview-img" />
    </div>
  </div>
</template>

<script setup>
/**
 * VirtualImage Panel Component | 人像库面板组件
 * 显示人像库列表，支持一键添加到画布
 */
import { computed, ref, watch } from 'vue'
import { NIcon } from 'naive-ui'
import { 
  CloseOutline,
  ChevronBackOutline,
  GridOutline, 
  ImageOutline, 
  VideocamOutline,
  BookOutline,
  PersonOutline,
  CartOutline,
  ChatbubbleOutline,
  FolderOutline
} from '@vicons/ionicons5'
import { fetchProjects, fetchVirtualImageTemplates } from '../api/virtualImages'

const props = defineProps({
  show: Boolean,
  projectName: { type: String, default: '未命名项目' }
})

const emit = defineEmits(['update:show', 'add-virtualimage', 'add-virtualimages'])

// Active tab | 当前标签
const activeTab = ref('role')

// Visible state | 显示状态
const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

// Project state | 项目状态
const projects = ref([])
const selectedProject = ref(null)

// 面板每次打开时加载项目列表 | Load projects on open
watch(visible, async (val) => {
  if (val) {
    selectedProject.value = null
    activeTab.value = 'role'
    await loadProjects()
  }
})

// Dynamic templates loaded from external folder | 从外部文件夹动态加载的模板
const templates = ref({ role: [], scene: [], prop: [], reference: [] })
const loading = ref(false)

async function loadProjects() {
  loading.value = true
  try {
    projects.value = await fetchProjects()
  } catch (err) {
    console.error('加载项目列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function selectProject(proj) {
  selectedProject.value = proj.name
  activeTab.value = 'role'
  templates.value = { role: [], scene: [], prop: [], reference: [] }
  suppressClickOutside.value = true
  await loadTemplates()
}

const suppressClickOutside = ref(false)

function goBackToProjects() {
  selectedProject.value = null
  templates.value = { role: [], scene: [], prop: [], reference: [] }
  suppressClickOutside.value = true
}

async function loadTemplates() {
  loading.value = true
  try {
    templates.value = await fetchVirtualImageTemplates(selectedProject.value)
  } catch (err) {
    console.error('加载虚拟人像库失败:', err)
  } finally {
    loading.value = false
  }
}

// Gallery state | 画廊状态
const showGallery = ref(false)
const galleryImages = ref([])
const galleryTitle = ref('')

// Handle view group images | 查看指定套图的所有图片
const handleViewGroupImages = (virtualimage) => {
  galleryImages.value = virtualimage.covers || []
  galleryTitle.value = virtualimage.name
  showGallery.value = true
}

// Preview state | 预览状态
const showPreview = ref(false)
const previewImage = ref('')

// Handle preview image | 预览大图
const handlePreview = (cover) => {
  previewImage.value = cover
  showPreview.value = true
}

// Handle apply single image from gallery | 从画廊添加单张图片到画布
const handleApplySingle = (cover, title, index) => {
  emit('add-virtualimage', {
    url: cover,
    name: `${title}-${index + 1}`
  })
  showGallery.value = false
  visible.value = false
}

// Active templates based on current tab | 根据当前标签显示对应模板
const activeTemplates = computed(() => {
  return templates.value[activeTab.value] || []
})

// Icon mapping | 图标映射
const iconMap = {
  GridOutline,
  ImageOutline,
  VideocamOutline,
  BookOutline,
  PersonOutline,
  ShoppingOutline: CartOutline,
  ChatbubbleOutline
}

const getIcon = (iconName) => {
  return iconMap[iconName] || GridOutline
}

const handleAddVirtualImages = (virtualimage) => {
  // 添加当前组件 covers 中全部图片到画布
  emit('add-virtualimages', {
    covers: virtualimage.covers,
    name: virtualimage.name
  })
  visible.value = false
}
// Handle click outside | 点击外部关闭
const handleClickOutside = () => {
  // 返回项目列表后跳过本次检测（按钮已被 Vue 移除，contains 会误判）
  if (suppressClickOutside.value) {
    suppressClickOutside.value = false
    return
  }
  // 画廊打开时不关闭面板，避免误触
  if (!showGallery.value) {
    visible.value = false
  }
}

// Custom directive | 自定义指令
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
/* Panel container | 面板容器 */
.virtualimage-panel {
  position: fixed;
  left: 72px;
  top: 80px;
  width: calc(100vw - 120px);
  height: calc(100vh - 100px);
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

:global(.dark) .virtualimage-panel,
:global(.dark) .gallery-content {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* Header | 头部 */
.panel-header {
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border-color);
}

/* Top row: project name + close button | 顶行：项目名称 + 关闭按钮 */
.panel-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.panel-top-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Back button | 返回按钮 */
.back-btn {
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
  flex-shrink: 0;
}

.back-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
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

/* Content | 内容区 */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* virtualimage grid | 虚拟人像库网格 */
.virtualimage-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}

/* virtualimage card | 虚拟人像库卡片 */
.virtualimage-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.virtualimage-card:hover {
  transform: translateY(-2px);
}

.virtualimage-card:hover .card-cover {
  border-color: var(--accent-color);
}

/* single role cards: 1:2 portrait | 角色卡片：1:2 竖版 */
.grid-role .card-cover {
  aspect-ratio: 1 / 2;
}

/* group set cards: 1:2 portrait (same as single) | 套图卡片：1:2 竖版 */
.grid-set .card-cover {
  aspect-ratio: 1 / 2;
}

.card-cover {
  position: relative;
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

/* Card hover overlay | 卡片悬浮遮罩 */
.card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 12px;
}

.virtualimage-card:hover .card-overlay {
  opacity: 1;
}

/* View button | 查看按钮 */
.view-btn {
  padding: 6px 20px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 8px;
}

.view-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}

/* Apply button | 应用按钮 */
.apply-btn {
  padding: 6px 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.apply-btn:hover {
  background: var(--accent-hover);
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

/* Empty state | 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  text-align: center;
  color: var(--text-secondary);
}

/* Transition | 过渡动画 */
.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.25s ease;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

/* Gallery overlay | 画廊弹层 */
.gallery-overlay {
  position: fixed;
  left: 72px;
  top: 80px;
  width: calc(100vw - 120px);
  height: calc(100vh - 100px);
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  border-radius: 16px;
}

.gallery-content {
  width: 95%;
  height: 90%;
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.gallery-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.gallery-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.gallery-img {
  width: 100%;
  aspect-ratio: 1 / 2;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}


/* Gallery item cover wrapper | 画廊项图片容器 */
.gallery-item-cover {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
}

/* Gallery item hover overlay | 画廊项悬浮遮罩 */
.gallery-item-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 0.2s;
  border-radius: 8px;
}

.gallery-item:hover .gallery-item-overlay {
  opacity: 1;
}

/* Gallery preview/apply buttons | 画廊预览/应用按钮 */
.gallery-preview-btn {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.gallery-preview-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}

.gallery-apply-btn {
  padding: 4px 12px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.gallery-apply-btn:hover {
  background: var(--accent-hover);
}

/* Preview overlay | 预览大图弹层 */
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.preview-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
}

.preview-close {
  position: absolute;
  top: -40px;
  right: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.preview-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.gallery-item-name {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

/* Scrollbar | 滚动条 */
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