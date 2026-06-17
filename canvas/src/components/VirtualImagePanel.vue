<template>
  <!-- VirtualImage panel| 虚拟人像库浮动面板 -->
  <Transition name="panel-slide">
    <div v-if="visible" class="virtualimage-panel" v-click-outside="handleClickOutside">
      <!-- Header | 头部 -->
      <div class="panel-header">
        <div class="panel-top">
          <div class="panel-top-left">
            <button v-if="selectedProject" class="back-btn" @click="handleBackClick">
              <n-icon :size="16"><ChevronBackOutline /></n-icon>
            </button>
            <n-input
              v-if="selectedProject && editingProjectName"
              ref="projectNameInputRef"
              v-model:value="editableProjectName"
              class="project-name-input"
              size="small"
              maxlength="50"
              :disabled="savingProjectMeta"
              @blur="finishEditProjectName"
              @keyup.enter="finishEditProjectName"
              @keyup.esc="cancelEditProjectName"
            />
            <span
              v-else-if="selectedProject"
              class="project-name editable-label"
              title="双击修改项目名称"
              @dblclick="startEditProjectName"
            >{{ editableProjectName || selectedProject }}</span>
            <span v-else class="project-name">项目名称</span>
          </div>
          <button class="expand-btn" @click="visible = false">
            <n-icon :size="16"><CloseOutline /></n-icon>
          </button>
        </div>
        <!-- Category tabs (only shown when a project is selected) -->
        <div v-if="selectedProject" class="panel-tabs">
          <div
            v-for="name in categoryList"
            :key="name"
            class="tab-item-wrap"
            :class="{ active: activeTab === name, editing: editingCategoryKey === name }"
          >
            <n-input
              v-if="editingCategoryKey === name"
              :ref="(el) => setCategoryInputRef(name, el)"
              v-model:value="categoryEditDraft"
              class="tab-input"
              size="tiny"
              maxlength="20"
              :disabled="savingProjectMeta"
              @blur="finishEditCategory(name)"
              @keyup.enter="finishEditCategory(name)"
              @keyup.esc="cancelEditCategory"
            />
            <span
              v-else
              class="tab-item"
              :class="{ active: activeTab === name }"
              title="单击切换，双击修改名称"
              @click="handleTabClick(name)"
              @dblclick.stop="startEditCategory(name)"
            >{{ name }}</span>
          </div>
          <button
            type="button"
            class="tab-add-btn"
            title="新增分类"
            :disabled="savingProjectMeta"
            @click="openAddCategoryModal"
          >
            <n-icon :size="18"><AddOutline /></n-icon>
          </button>
        </div>
        <div v-if="selectedProject && folderStack.length" class="folder-breadcrumb">
          <span class="breadcrumb-item" @click="resetFolderStack">{{ activeTab }}</span>
          <template v-for="(segment, index) in folderStack" :key="index">
            <span class="breadcrumb-sep">/</span>
            <span
              class="breadcrumb-item"
              :class="{ current: index === folderStack.length - 1 }"
              @click="jumpToFolder(index)"
            >{{ segment }}</span>
          </template>
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
              <img
                v-if="proj.icon"
                :src="proj.icon"
                :alt="proj.name"
                class="cover-img"
                @error="handleProjectIconError(proj)"
              />
              <button
                v-else
                type="button"
                class="set-icon-btn"
                @click.stop="openIconPickerForProject(proj)"
              >
                <n-icon :size="28"><ImageOutline /></n-icon>
                <span>设置参考图</span>
              </button>
              <div class="card-overlay">
                <button class="view-btn" @click.stop="selectProject(proj)">进入</button>
                <button
                  class="view-btn"
                  @click.stop="openIconPickerForProject(proj)"
                >{{ proj.icon ? '换参考图' : '选参考图' }}</button>
              </div>
            </div>
            <div class="card-title">{{ proj.name }}</div>
          </div>
          <div class="virtualimage-card add-card" @click="openAddProjectModal">
            <div class="card-cover add-card-cover">
              <n-icon :size="36" class="add-icon">
                <AddOutline />
              </n-icon>
            </div>
            <div class="card-title">新建项目</div>
          </div>
        </div>

        <!-- Category item grid (shown when a project is selected) -->
        <div v-else-if="!categoryList.length" class="empty-state">
          <n-icon :size="40" class="empty-icon"><FolderOutline /></n-icon>
          <p>还没有分类</p>
          <p class="empty-hint">点击上方标签栏右侧的 + 添加第一个分类</p>
        </div>
        <div v-else class="virtualimage-grid grid-set">
          <div 
            v-for="item in activeTemplates" 
            :key="item.id"
            class="virtualimage-card"
            :class="{ 'group-card': item.type === 'group' }"
          >
            <div class="card-cover">
              <template v-if="item.type === 'group'">
                <img
                  v-if="item.covers && item.covers[0]"
                  :src="item.covers[0]"
                  :alt="item.name"
                  class="cover-img"
                  @error="handleCoverError(item, $event)"
                />
                <button
                  v-else
                  type="button"
                  class="set-icon-btn"
                  @click.stop="openIconPickerForGroup(item)"
                >
                  <n-icon :size="28"><ImageOutline /></n-icon>
                  <span>设置参考图</span>
                </button>
                <div class="card-overlay">
                  <button class="view-btn" @click.stop="enterGroup(item)">进入</button>
                  <button
                    class="view-btn"
                    @click.stop="openIconPickerForGroup(item)"
                  >{{ item.covers && item.covers[0] ? '换参考图' : '选参考图' }}</button>
                </div>
              </template>
              <template v-else>
                <img
                  v-if="item.covers && item.covers[0]"
                  :src="item.covers[0]"
                  :alt="item.name"
                  class="cover-img"
                  @error="handleCoverError(item, $event)"
                />
                <n-icon v-else :size="36" class="cover-icon">
                  <component :is="getIcon(item.icon)" />
                </n-icon>
                <div class="card-overlay">
                  <button class="view-btn" @click.stop="handleViewGroupImages(item)">查看</button>
                  <button class="apply-btn" @click.stop="handleAddVirtualImages(item)">应用</button>
                </div>
              </template>
            </div>
            <n-input
              v-if="editingItemId === item.id"
              v-model:value="itemEditDraft"
              class="card-title-input"
              size="tiny"
              maxlength="50"
              :disabled="savingItemMeta"
              @blur="finishEditItem(item)"
              @keyup.enter="finishEditItem(item)"
              @keyup.esc="cancelEditItem"
              @click.stop
            />
            <div
              v-else
              class="card-title editable-label"
              title="双击修改名称"
              @dblclick.stop="startEditItem(item)"
            >{{ item.name }}</div>
          </div>
          <div class="virtualimage-card add-card" @click="openAddItemModal">
            <div class="card-cover add-card-cover">
              <n-icon :size="36" class="add-icon">
                <AddOutline />
              </n-icon>
            </div>
            <div class="card-title">新建套图</div>
          </div>
          <div class="virtualimage-card add-card" @click="openAddGroupModal">
            <div class="card-cover add-card-cover">
              <n-icon :size="36" class="add-icon">
                <FolderOutline />
              </n-icon>
            </div>
            <div class="card-title">新建子分类</div>
          </div>
        </div>
      </div>
    </div>

  </Transition>

  <n-modal v-model:show="showAddProjectModal" preset="dialog" title="新建项目">
    <div class="create-project-form">
      <n-input
        v-model:value="newProjectName"
        placeholder="请输入项目名称"
        maxlength="50"
        @keyup.enter="confirmAddProject"
      />
      <div class="icon-picker" @click="triggerNewProjectIconPick">
        <img v-if="newProjectIconPreview" :src="newProjectIconPreview" alt="参考图预览" class="icon-preview" />
        <div v-else class="icon-placeholder">
          <n-icon :size="28"><ImageOutline /></n-icon>
          <span>选择参考图（可选）</span>
        </div>
      </div>
      <button
        v-if="newProjectIconPreview"
        type="button"
        class="clear-icon-btn"
        @click.stop="clearNewProjectIcon"
      >清除参考图</button>
    </div>
    <template #action>
      <n-button @click="showAddProjectModal = false">取消</n-button>
      <n-button type="primary" :loading="creatingProject" @click="confirmAddProject">确定</n-button>
    </template>
  </n-modal>

  <n-modal v-model:show="showAddCategoryModal" preset="dialog" title="新增分类">
    <n-input
      v-model:value="newCategoryName"
      placeholder="请输入分类名称"
      maxlength="20"
      @keyup.enter="confirmAddCategory"
    />
    <template #action>
      <n-button @click="showAddCategoryModal = false">取消</n-button>
      <n-button type="primary" :loading="creatingCategory" @click="confirmAddCategory">确定</n-button>
    </template>
  </n-modal>

  <n-modal v-model:show="showAddItemModal" preset="dialog" title="新建套图">
    <n-input
      v-model:value="newItemName"
      placeholder="请输入套图名称，如：暗杀者"
      maxlength="50"
      @keyup.enter="confirmAddItem"
    />
    <template #action>
      <n-button @click="showAddItemModal = false">取消</n-button>
      <n-button type="primary" :loading="creatingItem" @click="confirmAddItem">确定</n-button>
    </template>
  </n-modal>

  <n-modal v-model:show="showAddGroupModal" preset="dialog" title="新建子分类">
    <div class="create-project-form">
      <n-input
        v-model:value="newGroupName"
        placeholder="请输入子分类名称，如：第一集"
        maxlength="50"
        @keyup.enter="confirmAddGroup"
      />
      <div class="icon-picker" @click="triggerNewGroupIconPick">
        <img v-if="newGroupIconPreview" :src="newGroupIconPreview" alt="参考图预览" class="icon-preview" />
        <div v-else class="icon-placeholder">
          <n-icon :size="28"><ImageOutline /></n-icon>
          <span>选择参考图（可选）</span>
        </div>
      </div>
      <button
        v-if="newGroupIconPreview"
        type="button"
        class="clear-icon-btn"
        @click.stop="clearNewGroupIcon"
      >清除参考图</button>
    </div>
    <template #action>
      <n-button @click="showAddGroupModal = false">取消</n-button>
      <n-button type="primary" :loading="creatingGroup" @click="confirmAddGroup">确定</n-button>
    </template>
  </n-modal>

  <input
    ref="newProjectIconInput"
    type="file"
    accept="image/*"
    class="hidden-file-input"
    @change="onNewProjectIconSelected"
  />
  <input
    ref="newGroupIconInput"
    type="file"
    accept="image/*"
    class="hidden-file-input"
    @change="onNewGroupIconSelected"
  />
  <input
    ref="projectIconInput"
    type="file"
    accept="image/*"
    class="hidden-file-input"
    @change="onProjectIconSelected"
  />
  <input
    ref="groupIconInput"
    type="file"
    accept="image/*"
    class="hidden-file-input"
    @change="onGroupIconSelected"
  />

  <!-- Image gallery overlay | 图片画廊弹层 -->
  <div v-if="showGallery" class="gallery-overlay" v-click-outside="handleGalleryClickOutside">
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
        <div
          class="gallery-item add-gallery-item"
          :class="{ uploading: uploadingGalleryImages }"
          @click.stop="triggerGalleryImagePick"
        >
          <div class="gallery-item-cover add-gallery-cover">
            <n-icon :size="32" class="add-icon"><AddOutline /></n-icon>
            <span>添加图片</span>
          </div>
        </div>
      </div>
      <input
        ref="galleryImageInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden-file-input"
        @change="onGalleryImagesSelected"
      />
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
import { computed, ref, watch, nextTick } from 'vue'
import { NIcon, NModal, NInput, NButton } from 'naive-ui'
import { 
  CloseOutline,
  ChevronBackOutline,
  AddOutline,
  FolderOutline,
  GridOutline, 
  ImageOutline, 
  VideocamOutline,
  BookOutline,
  PersonOutline,
  CartOutline,
  ChatbubbleOutline,
} from '@vicons/ionicons5'
import {
  fetchProjects,
  fetchVirtualImageTemplates,
  createVirtualImageProject,
  uploadVirtualImageProjectIcon,
  updateVirtualImageProject,
  addVirtualImageCategory,
  renameVirtualImageCategory,
  createVirtualImageItem,
  createVirtualImageGroup,
  renameVirtualImageNode,
  uploadVirtualImageGroupIcon,
  uploadVirtualImageItemImages,
  withIconCacheBust,
  normalizeCategoryList,
} from '../api/virtualImages'

const props = defineProps({
  show: Boolean,
  projectName: { type: String, default: '未命名项目' }
})

const emit = defineEmits(['update:show', 'add-virtualimage', 'add-virtualimages'])

// Active tab | 当前标签（分类文件夹名称）
const activeTab = ref('')
const categoryList = ref([])
const categoryEditDraft = ref('')
const editingCategoryOriginal = ref('')
const editableProjectName = ref('')
const savingProjectMeta = ref(false)
const lastSavedProjectName = ref('')
const editingProjectName = ref(false)
const editingCategoryKey = ref(null)
const showAddCategoryModal = ref(false)
const newCategoryName = ref('')
const creatingCategory = ref(false)
const showAddItemModal = ref(false)
const newItemName = ref('')
const creatingItem = ref(false)
const showAddGroupModal = ref(false)
const newGroupName = ref('')
const newGroupIconFile = ref(null)
const newGroupIconPreview = ref('')
const newGroupIconInput = ref(null)
const creatingGroup = ref(false)
const folderStack = ref([])
const pathItems = ref([])
const editingItemId = ref(null)
const itemEditDraft = ref('')
const editingItemOriginal = ref('')
const savingItemMeta = ref(false)
const galleryImageInput = ref(null)
const galleryContext = ref(null)
const uploadingGalleryImages = ref(false)
const suppressGalleryClickOutside = ref(false)
const projectViewState = ref({})
const lastOpenedProject = ref(null)
const projectNameInputRef = ref(null)
const categoryInputRefs = ref({})
let tabClickTimer = null

function saveProjectViewState() {
  if (!selectedProject.value || !activeTab.value) return
  projectViewState.value = {
    ...projectViewState.value,
    [selectedProject.value]: {
      activeTab: activeTab.value,
      folderStack: [...folderStack.value],
    },
  }
}

function restoreProjectViewState(projectName) {
  const saved = projectViewState.value[projectName]
  if (!saved?.activeTab) return false
  if (!categoryList.value.includes(saved.activeTab)) return false
  activeTab.value = saved.activeTab
  folderStack.value = Array.isArray(saved.folderStack) ? [...saved.folderStack] : []
  return true
}

function migrateProjectViewState(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return
  if (!projectViewState.value[oldName]) return
  projectViewState.value = {
    ...projectViewState.value,
    [newName]: projectViewState.value[oldName],
  }
  delete projectViewState.value[oldName]
}

function renameProjectViewCategory(projectName, fromName, toName) {
  const saved = projectViewState.value[projectName]
  if (!saved || saved.activeTab !== fromName) return
  projectViewState.value = {
    ...projectViewState.value,
    [projectName]: {
      ...saved,
      activeTab: toName,
    },
  }
}

function setCategoryInputRef(key, el) {
  if (el) {
    categoryInputRefs.value[key] = el
  }
}

function focusCategoryInput(key) {
  nextTick(() => {
    const input = categoryInputRefs.value[key]
    input?.focus?.()
    input?.select?.()
  })
}

function startEditProjectName() {
  if (savingProjectMeta.value) return
  editingProjectName.value = true
  nextTick(() => {
    const input = projectNameInputRef.value
    input?.focus?.()
    input?.select?.()
  })
}

function cancelEditProjectName() {
  editableProjectName.value = lastSavedProjectName.value
  editingProjectName.value = false
}

async function finishEditProjectName() {
  if (!editingProjectName.value) return
  editingProjectName.value = false
  await saveProjectName()
}

function handleTabClick(key) {
  if (editingCategoryKey.value) return
  if (tabClickTimer) clearTimeout(tabClickTimer)
  tabClickTimer = setTimeout(() => {
    activeTab.value = key
    folderStack.value = []
    pathItems.value = []
    saveProjectViewState()
    tabClickTimer = null
  }, 220)
}

function startEditCategory(name) {
  if (savingProjectMeta.value) return
  if (tabClickTimer) {
    clearTimeout(tabClickTimer)
    tabClickTimer = null
  }
  activeTab.value = name
  editingCategoryOriginal.value = name
  categoryEditDraft.value = name
  editingCategoryKey.value = name
  focusCategoryInput(name)
}

function cancelEditCategory() {
  categoryEditDraft.value = editingCategoryOriginal.value
  editingCategoryKey.value = null
}

async function finishEditCategory(name) {
  if (editingCategoryKey.value !== name) return
  editingCategoryKey.value = null
  await saveCategoryRename()
}

function openAddCategoryModal() {
  newCategoryName.value = ''
  showAddCategoryModal.value = true
}

async function confirmAddCategory() {
  const name = newCategoryName.value.trim()
  if (!name) {
    window.$message?.warning('请输入分类名称')
    return
  }
  if (!selectedProject.value) return

  creatingCategory.value = true
  try {
    const updated = await addVirtualImageCategory(selectedProject.value, name)
    categoryList.value = normalizeCategoryList(updated.categories)
    activeTab.value = name
    showAddCategoryModal.value = false
    newCategoryName.value = ''
    updateProjectInList(updated)
    await loadTemplates()
    saveProjectViewState()
    window.$message?.success('分类已添加')
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || '添加分类失败'
    window.$message?.error(msg)
  } finally {
    creatingCategory.value = false
  }
}

function openAddItemModal() {
  if (!activeTab.value) {
    window.$message?.warning('请先选择分类')
    return
  }
  newItemName.value = ''
  showAddItemModal.value = true
}

async function confirmAddItem() {
  const name = newItemName.value.trim()
  if (!name) {
    window.$message?.warning('请输入套图名称')
    return
  }
  if (!selectedProject.value || !activeTab.value) return

  creatingItem.value = true
  try {
    const item = await createVirtualImageItem(
      selectedProject.value,
      currentCategoryPath.value,
      name
    )
    showAddItemModal.value = false
    newItemName.value = ''
    await loadTemplates()
    window.$message?.success('套图已创建')
    handleViewGroupImages(item)
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || '创建套图失败'
    window.$message?.error(msg)
  } finally {
    creatingItem.value = false
  }
}

function openAddGroupModal() {
  if (!activeTab.value) {
    window.$message?.warning('请先选择分类')
    return
  }
  newGroupName.value = ''
  resetNewGroupIcon()
  showAddGroupModal.value = true
}

function resetNewGroupIcon() {
  if (newGroupIconPreview.value) {
    URL.revokeObjectURL(newGroupIconPreview.value)
  }
  newGroupIconFile.value = null
  newGroupIconPreview.value = ''
  if (newGroupIconInput.value) {
    newGroupIconInput.value.value = ''
  }
}

function triggerNewGroupIconPick() {
  newGroupIconInput.value?.click()
}

function clearNewGroupIcon() {
  resetNewGroupIcon()
}

function onNewGroupIconSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    window.$message?.warning('请选择图片文件')
    event.target.value = ''
    return
  }
  resetNewGroupIcon()
  newGroupIconFile.value = file
  newGroupIconPreview.value = URL.createObjectURL(file)
}

async function confirmAddGroup() {
  const name = newGroupName.value.trim()
  if (!name) {
    window.$message?.warning('请输入子分类名称')
    return
  }
  if (!selectedProject.value || !activeTab.value) return

  creatingGroup.value = true
  try {
    const categoryPath = currentCategoryPath.value
    let item = await createVirtualImageGroup(
      selectedProject.value,
      categoryPath,
      name
    )
    if (newGroupIconFile.value) {
      item = await uploadVirtualImageGroupIcon(
        selectedProject.value,
        categoryPath,
        name,
        newGroupIconFile.value
      )
    }
    showAddGroupModal.value = false
    newGroupName.value = ''
    resetNewGroupIcon()
    await loadTemplates()
    window.$message?.success('子分类已创建')
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || '创建子分类失败'
    window.$message?.error(msg)
  } finally {
    creatingGroup.value = false
  }
}

function syncCategoryListFromProject(project) {
  categoryList.value = normalizeCategoryList(project?.categories)
}

function syncEditableProjectFields(project) {
  editableProjectName.value = project?.name || selectedProject.value || ''
  lastSavedProjectName.value = editableProjectName.value
  syncCategoryListFromProject(project)
}

async function saveCategoryRename() {
  if (!selectedProject.value || savingProjectMeta.value) return

  const fromName = editingCategoryOriginal.value
  const toName = categoryEditDraft.value.trim()
  if (!toName) {
    categoryEditDraft.value = fromName
    window.$message?.warning('分类名称不能为空')
    return
  }
  if (toName === fromName) return

  savingProjectMeta.value = true
  try {
    const updated = await renameVirtualImageCategory(selectedProject.value, fromName, toName)
    syncCategoryListFromProject(updated)
    if (activeTab.value === fromName) {
      activeTab.value = toName
    }
    renameProjectViewCategory(selectedProject.value, fromName, toName)
    saveProjectViewState()
    updateProjectInList(updated)
    await loadTemplates()
    window.$message?.success('分类名称与文件夹已更新')
  } catch (err) {
    categoryEditDraft.value = fromName
    const msg = err?.response?.data?.error || err?.message || '更新分类名称失败'
    window.$message?.error(msg)
  } finally {
    savingProjectMeta.value = false
    editingCategoryOriginal.value = ''
  }
}

function startEditItem(item) {
  if (savingItemMeta.value || savingProjectMeta.value) return
  editingItemId.value = item.id
  editingItemOriginal.value = item.name
  itemEditDraft.value = item.name
}

function cancelEditItem() {
  itemEditDraft.value = editingItemOriginal.value
  editingItemId.value = null
}

async function finishEditItem(item) {
  if (editingItemId.value !== item.id) return
  editingItemId.value = null
  await saveItemRename(item)
}

async function saveItemRename(item) {
  if (!selectedProject.value || savingItemMeta.value) return

  const fromName = editingItemOriginal.value
  const toName = itemEditDraft.value.trim()
  const categoryPath = item.category || currentCategoryPath.value
  if (!toName) {
    itemEditDraft.value = fromName
    window.$message?.warning('名称不能为空')
    return
  }
  if (toName === fromName) return

  savingItemMeta.value = true
  try {
    const updated = await renameVirtualImageNode(
      selectedProject.value,
      categoryPath,
      fromName,
      toName
    )

    const stackIndex = folderStack.value.indexOf(fromName)
    if (stackIndex >= 0) {
      const nextStack = [...folderStack.value]
      nextStack[stackIndex] = toName
      folderStack.value = nextStack
    }

    if (galleryContext.value?.item === fromName && galleryContext.value?.category === categoryPath) {
      galleryTitle.value = toName
      galleryContext.value = {
        ...galleryContext.value,
        item: toName,
      }
      galleryImages.value = (updated.covers || []).map((url) => withIconCacheBust(url))
    }

    await loadTemplates()
    window.$message?.success(
      updated.type === 'group' ? '子分类名称已更新' : '套图名称已更新'
    )
  } catch (err) {
    itemEditDraft.value = fromName
    const msg = err?.response?.data?.error || err?.message || '更新名称失败'
    window.$message?.error(msg)
  } finally {
    savingItemMeta.value = false
    editingItemOriginal.value = ''
  }
}

// Visible state | 显示状态
const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

// Project state | 项目状态
const projects = ref([])
const selectedProject = ref(null)
const showAddProjectModal = ref(false)
const newProjectName = ref('')
const newProjectIconFile = ref(null)
const newProjectIconPreview = ref('')
const creatingProject = ref(false)
const newProjectIconInput = ref(null)
const projectIconInput = ref(null)
const groupIconInput = ref(null)
const iconTargetProject = ref(null)
const iconTargetGroup = ref(null)
const uploadingProjectIcon = ref(false)
const uploadingGroupIcon = ref(false)

function resetNewProjectIcon() {
  if (newProjectIconPreview.value) {
    URL.revokeObjectURL(newProjectIconPreview.value)
  }
  newProjectIconFile.value = null
  newProjectIconPreview.value = ''
  if (newProjectIconInput.value) {
    newProjectIconInput.value.value = ''
  }
}

function openAddProjectModal() {
  newProjectName.value = ''
  resetNewProjectIcon()
  showAddProjectModal.value = true
}

function triggerNewProjectIconPick() {
  newProjectIconInput.value?.click()
}

function clearNewProjectIcon() {
  resetNewProjectIcon()
}

function onNewProjectIconSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    window.$message?.warning('请选择图片文件')
    event.target.value = ''
    return
  }
  resetNewProjectIcon()
  newProjectIconFile.value = file
  newProjectIconPreview.value = URL.createObjectURL(file)
}

function openIconPickerForProject(proj) {
  iconTargetProject.value = proj
  projectIconInput.value?.click()
}

function openIconPickerForGroup(item) {
  iconTargetGroup.value = item
  groupIconInput.value?.click()
}

function updateItemInTemplates(updatedItem) {
  const nextItem = {
    ...updatedItem,
    type: updatedItem.type || 'item',
    covers: (updatedItem.covers || []).map((url) => withIconCacheBust(url)),
  }
  const tab = activeTab.value
  const updateList = (list) => {
    const index = list.findIndex((entry) => entry.id === nextItem.id)
    if (index >= 0) {
      const copy = [...list]
      copy[index] = nextItem
      return copy
    }
    return list
  }
  if (folderStack.value.length > 0) {
    pathItems.value = updateList(pathItems.value)
  } else if (templates.value[tab]) {
    templates.value = {
      ...templates.value,
      [tab]: updateList(templates.value[tab]),
    }
  }
}

async function onGroupIconSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  const target = iconTargetGroup.value
  iconTargetGroup.value = null
  if (!file || !target || !selectedProject.value) return
  if (!file.type.startsWith('image/')) {
    window.$message?.warning('请选择图片文件')
    return
  }

  uploadingGroupIcon.value = true
  try {
    const item = await uploadVirtualImageGroupIcon(
      selectedProject.value,
      target.category || currentCategoryPath.value,
      target.name,
      file
    )
    updateItemInTemplates(item)
    window.$message?.success('参考图已设置')
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || '上传参考图失败'
    window.$message?.error(msg)
  } finally {
    uploadingGroupIcon.value = false
  }
}

function updateProjectInList(updatedProject) {
  const icon = withIconCacheBust(updatedProject.icon)
  const next = { ...updatedProject, icon }
  const index = projects.value.findIndex((item) => item.id === updatedProject.id)
  if (index >= 0) {
    projects.value[index] = next
    projects.value = [...projects.value]
  }
}

function handleProjectIconError(proj) {
  const index = projects.value.findIndex((item) => item.id === proj.id)
  if (index >= 0) {
    projects.value[index] = { ...projects.value[index], icon: null }
    projects.value = [...projects.value]
  }
}

async function onProjectIconSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  const target = iconTargetProject.value
  iconTargetProject.value = null
  if (!file || !target) return
  if (!file.type.startsWith('image/')) {
    window.$message?.warning('请选择图片文件')
    return
  }

  uploadingProjectIcon.value = true
  try {
    const updated = await uploadVirtualImageProjectIcon(target.name, file)
    updateProjectInList(updated)
    window.$message?.success('参考图已设置')
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || '上传参考图失败'
    window.$message?.error(msg)
  } finally {
    uploadingProjectIcon.value = false
  }
}

async function confirmAddProject() {
  const name = newProjectName.value.trim()
  if (!name) {
    window.$message?.warning('请输入项目名称')
    return
  }
  creatingProject.value = true
  try {
    let project = await createVirtualImageProject(name)
    if (newProjectIconFile.value) {
      project = await uploadVirtualImageProjectIcon(name, newProjectIconFile.value)
      project = { ...project, icon: withIconCacheBust(project.icon) }
    }
    projects.value = [...projects.value, project].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    showAddProjectModal.value = false
    newProjectName.value = ''
    resetNewProjectIcon()
    window.$message?.success('项目已创建')
    await selectProject(project)
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || '创建项目失败'
    window.$message?.error(msg)
  } finally {
    creatingProject.value = false
  }
}

// 面板打开/关闭时记住浏览位置 | Persist view on open/close
watch(visible, async (val) => {
  if (val) {
    editingProjectName.value = false
    editingCategoryKey.value = null
    editingItemId.value = null
    await loadProjects()
    if (selectedProject.value) {
      restoreProjectViewState(selectedProject.value)
      await loadTemplates()
      return
    }
    const lastProject = lastOpenedProject.value
    if (lastProject) {
      const proj = projects.value.find((p) => p.name === lastProject || p.id === lastProject)
      if (proj) {
        await selectProject(proj)
      }
    }
  } else {
    saveProjectViewState()
    if (selectedProject.value) {
      lastOpenedProject.value = selectedProject.value
    }
  }
})

// Dynamic templates loaded from external folder | 从外部文件夹动态加载的模板
const templates = ref({})
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
  lastOpenedProject.value = proj.name
  syncEditableProjectFields(proj)
  if (!restoreProjectViewState(proj.name)) {
    activeTab.value = categoryList.value[0] || ''
    folderStack.value = []
  }
  pathItems.value = []
  templates.value = {}
  suppressClickOutside.value = true
  await loadTemplates()
}

async function saveProjectName() {
  if (!selectedProject.value || savingProjectMeta.value) return
  const nextName = editableProjectName.value.trim()
  if (!nextName) {
    editableProjectName.value = lastSavedProjectName.value
    window.$message?.warning('项目名称不能为空')
    return
  }
  if (nextName === lastSavedProjectName.value) return

  savingProjectMeta.value = true
  try {
    const updated = await updateVirtualImageProject(selectedProject.value, { name: nextName })
    const oldName = selectedProject.value
    selectedProject.value = updated.name
    migrateProjectViewState(oldName, updated.name)
    syncEditableProjectFields(updated)
    const index = projects.value.findIndex((item) => item.id === oldName)
    if (index >= 0) {
      projects.value[index] = { ...updated, icon: withIconCacheBust(updated.icon) }
      projects.value = [...projects.value].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    }
    await loadTemplates()
    window.$message?.success('项目名称已更新')
  } catch (err) {
    editableProjectName.value = lastSavedProjectName.value
    const msg = err?.response?.data?.error || err?.message || '更新项目名称失败'
    window.$message?.error(msg)
  } finally {
    savingProjectMeta.value = false
  }
}

const suppressClickOutside = ref(false)

function goBackToProjects() {
  editingProjectName.value = false
  editingCategoryKey.value = null
  editingItemId.value = null
  selectedProject.value = null
  templates.value = {}
  folderStack.value = []
  pathItems.value = []
  suppressClickOutside.value = true
}

function handleBackClick() {
  if (folderStack.value.length > 0) {
    folderStack.value = folderStack.value.slice(0, -1)
    loadCurrentFolderItems()
    saveProjectViewState()
    return
  }
  goBackToProjects()
}

async function enterGroup(item) {
  folderStack.value = [...folderStack.value, item.name]
  await loadCurrentFolderItems()
  saveProjectViewState()
}

async function resetFolderStack() {
  if (!folderStack.value.length) return
  folderStack.value = []
  pathItems.value = []
  saveProjectViewState()
}

async function jumpToFolder(index) {
  if (index >= folderStack.value.length - 1) return
  folderStack.value = folderStack.value.slice(0, index + 1)
  await loadCurrentFolderItems()
  saveProjectViewState()
}

function mapTemplateItems(items) {
  return (items || []).map((item) => ({
    ...item,
    type: item.type || 'item',
    covers: (item.covers || []).map((url) => withIconCacheBust(url)),
  }))
}

const currentCategoryPath = computed(() => {
  return [activeTab.value, ...folderStack.value].filter(Boolean).join('/')
})

async function loadCurrentFolderItems() {
  if (!selectedProject.value || !folderStack.value.length) {
    pathItems.value = []
    return
  }
  try {
    const data = await fetchVirtualImageTemplates(
      selectedProject.value,
      currentCategoryPath.value
    )
    pathItems.value = mapTemplateItems(data?.items || [])
  } catch (err) {
    console.error('加载子分类内容失败:', err)
    pathItems.value = []
  }
}

async function loadTemplates() {
  loading.value = true
  try {
    const data = await fetchVirtualImageTemplates(selectedProject.value)
    categoryList.value = normalizeCategoryList(data?.categories)
    if (!categoryList.value.includes(activeTab.value)) {
      if (!restoreProjectViewState(selectedProject.value)) {
        activeTab.value = categoryList.value[0] || ''
        folderStack.value = []
      }
    }
    const next = {}
    for (const name of categoryList.value) {
      next[name] = mapTemplateItems(data?.[name] || [])
    }
    templates.value = next
    await loadCurrentFolderItems()
    saveProjectViewState()
  } catch (err) {
    console.error('加载虚拟人像库失败:', err)
  } finally {
    loading.value = false
  }
}

async function handleCoverError(_item, event) {
  const img = event?.target
  if (!img || img.dataset.retried === '1') return
  img.dataset.retried = '1'
  await loadTemplates()
}

// Gallery state | 画廊状态
const showGallery = ref(false)
const galleryImages = ref([])
const galleryTitle = ref('')

// Handle view group images | 查看指定套图的所有图片
const handleViewGroupImages = (virtualimage) => {
  galleryImages.value = (virtualimage.covers || []).map((url) => withIconCacheBust(url))
  galleryTitle.value = virtualimage.name
  galleryContext.value = {
    category: virtualimage.category || activeTab.value,
    item: virtualimage.name,
  }
  showGallery.value = true
}

function triggerGalleryImagePick() {
  if (!galleryContext.value || uploadingGalleryImages.value) return
  suppressGalleryClickOutside.value = true
  const resetSuppress = () => {
    window.removeEventListener('focus', resetSuppress)
    setTimeout(() => {
      suppressGalleryClickOutside.value = false
    }, 200)
  }
  window.addEventListener('focus', resetSuppress)
  galleryImageInput.value?.click()
}

function handleGalleryClickOutside() {
  if (suppressGalleryClickOutside.value || uploadingGalleryImages.value || showPreview.value) return
  showGallery.value = false
}

async function onGalleryImagesSelected(event) {
  suppressGalleryClickOutside.value = false
  const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'))
  event.target.value = ''
  const ctx = galleryContext.value
  if (!files.length || !ctx || !selectedProject.value) return

  uploadingGalleryImages.value = true
  try {
    const item = await uploadVirtualImageItemImages(
      selectedProject.value,
      ctx.category,
      ctx.item,
      files
    )
    galleryImages.value = (item.covers || []).map((url) => withIconCacheBust(url))
    galleryContext.value = { category: item.category, item: item.name }
    await loadTemplates()
    window.$message?.success(`已添加 ${files.length} 张图片`)
  } catch (err) {
    const msg = err?.response?.data?.error || err?.message || '上传图片失败'
    window.$message?.error(msg)
  } finally {
    uploadingGalleryImages.value = false
  }
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
  if (folderStack.value.length > 0) {
    return pathItems.value
  }
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
function isPanelBlockingLayerOpen() {
  return (
    showGallery.value ||
    showPreview.value ||
    showAddProjectModal.value ||
    showAddCategoryModal.value ||
    showAddItemModal.value ||
    showAddGroupModal.value
  )
}

function isIgnoredPanelOutsideClick(target) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      '.n-modal-container, .n-modal-mask, .n-dialog, .n-popover, .gallery-overlay, .preview-overlay, .hidden-file-input'
    )
  )
}

const handleClickOutside = () => {
  // 返回项目列表后跳过本次检测（按钮已被 Vue 移除，contains 会误判）
  if (suppressClickOutside.value) {
    suppressClickOutside.value = false
    return
  }
  // 弹层/对话框打开时保持资产库面板可见
  if (isPanelBlockingLayerOpen()) return
  visible.value = false
}

// Custom directive | 自定义指令
const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      const target = e.target
      if (!el.contains(target) && !isIgnoredPanelOutsideClick(target)) {
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

.editable-label {
  cursor: text;
  border-radius: 6px;
  padding: 2px 6px;
  margin: -2px -6px;
  transition: background 0.2s;
}

.editable-label:hover {
  background: var(--bg-tertiary);
}

.project-name-input {
  width: min(320px, 42vw);
}

.project-name-input :deep(.n-input__input-el) {
  font-size: 18px;
  font-weight: 600;
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
  gap: 16px;
  flex-wrap: wrap;
}

.tab-item-wrap {
  min-width: 72px;
}

.tab-item-wrap.active .tab-item,
.tab-item-wrap.editing {
  border-bottom: 2px solid var(--accent-color);
}

.tab-item-wrap.active .tab-item {
  color: var(--text-primary);
  font-weight: 600;
}

.tab-input {
  width: 88px;
}

.tab-input :deep(.n-input__input-el) {
  text-align: center;
  color: var(--text-secondary);
}

.tab-item {
  display: inline-block;
  font-size: 15px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.2s;
  padding: 0 4px 4px;
  user-select: none;
}

.tab-item:hover {
  color: var(--text-primary);
}

.tab-item.active {
  color: var(--text-primary);
  font-weight: 500;
}

.tab-add-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  background: transparent;
  color: var(--accent-color);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  align-self: center;
}

.tab-add-btn:hover:not(:disabled) {
  border-color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 8%, transparent);
}

.tab-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.set-icon-btn {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 12px;
  transition: color 0.2s, background 0.2s;
}

.set-icon-btn span {
  font-size: 12px;
  line-height: 1.3;
}

.set-icon-btn:hover {
  color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 8%, transparent);
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

.card-title-input {
  margin-top: 10px;
  width: 100%;
}

.card-title-input :deep(.n-input__input-el) {
  text-align: center;
  font-size: 13px;
}

.tab-add-btn:hover {
  color: var(--accent-color);
  border-color: var(--accent-color);
}

.folder-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 16px 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

.breadcrumb-item {
  cursor: pointer;
  transition: color 0.2s;
}

.breadcrumb-item:hover:not(.current) {
  color: var(--accent-color);
}

.breadcrumb-item.current {
  color: var(--text-primary);
  cursor: default;
}

.breadcrumb-sep {
  opacity: 0.5;
}

.group-card .cover-icon {
  color: var(--accent-color);
}

/* Add project card | 新建项目卡片 */
.add-card-cover {
  border-style: dashed;
  background: transparent;
}

.add-card:hover .add-card-cover {
  border-color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 8%, transparent);
}

.add-icon {
  color: var(--accent-color);
}

.add-card:hover {
  transform: translateY(-2px);
}

.hidden-file-input {
  display: none;
}

.create-project-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.icon-picker {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-tertiary);
  transition: border-color 0.2s, background 0.2s;
}

.icon-picker:hover {
  border-color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 8%, var(--bg-tertiary));
}

.icon-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.clear-icon-btn {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.clear-icon-btn:hover {
  color: var(--accent-color);
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

.empty-icon {
  margin-bottom: 12px;
  color: var(--accent-color);
  opacity: 0.7;
}

.empty-hint {
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.8;
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

.add-gallery-item {
  cursor: pointer;
}

.add-gallery-cover {
  width: 100%;
  aspect-ratio: 1 / 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
}

.add-gallery-item:hover .add-gallery-cover {
  border-color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  color: var(--accent-color);
}

.add-gallery-item:hover .add-icon {
  color: var(--accent-color);
}

.add-gallery-item.uploading {
  pointer-events: none;
  opacity: 0.6;
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