/**
 * Virtual Image API | 虚拟人像库 API
 * Dev: Vite middleware (/api/virtual-images)
 * ComfyUI: Portal backend (/rh/api/virtual-images)
 */
import axios from 'axios'

function useComfyPortalPaths() {
  if (typeof window === 'undefined') return false
  return window.location.pathname.includes('/rh/canvas2')
}

function apiBase() {
  return useComfyPortalPaths() ? '/rh/api/virtual-images' : '/api/virtual-images'
}

function imageBase() {
  return useComfyPortalPaths() ? '/rh/virtual-images' : '/virtual-images'
}

/**
 * Fetch all projects (top-level folders under the virtual-image base)
 * Returns [{ id, name, icon }]
 */
export async function fetchProjects() {
  const { data } = await axios.get(`${apiBase()}/projects`)
  return data
}

/**
 * Create a new virtual-image project folder
 * @param {string} name - project folder name
 * Returns { id, name, icon }
 */
export async function createVirtualImageProject(name) {
  const { data } = await axios.post(`${apiBase()}/projects`, { name })
  return data.project
}

/**
 * Upload or replace a project cover/reference image
 * @param {string} projectName
 * @param {File|Blob} file
 * Returns { id, name, icon }
 */
export async function uploadVirtualImageProjectIcon(projectName, file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await axios.post(
    `${apiBase()}/projects/${encodeURIComponent(projectName)}/icon`,
    form
  )
  return data.project
}

/**
 * Update project name and/or category labels
 * @param {string} projectName
 * @param {{ name?: string, categories?: Record<string, string> }} payload
 */
export async function updateVirtualImageProject(projectName, payload) {
  const { data } = await axios.put(
    `${apiBase()}/projects/${encodeURIComponent(projectName)}`,
    payload
  )
  return data.project
}

export async function addVirtualImageCategory(projectName, categoryName) {
  return updateVirtualImageProject(projectName, { add_category: categoryName })
}

export async function renameVirtualImageCategory(projectName, fromName, toName) {
  return updateVirtualImageProject(projectName, {
    rename_category: { from: fromName, to: toName },
  })
}

export async function createVirtualImageItem(projectName, categoryPath, name) {
  const { data } = await axios.post(
    `${apiBase()}/projects/${encodeURIComponent(projectName)}/items`,
    { category: categoryPath, name, type: 'item' }
  )
  return data.item
}

export async function createVirtualImageGroup(projectName, categoryPath, name) {
  const { data } = await axios.post(
    `${apiBase()}/projects/${encodeURIComponent(projectName)}/items`,
    { category: categoryPath, name, type: 'group' }
  )
  return data.item
}

export async function renameVirtualImageNode(projectName, categoryPath, fromName, toName) {
  const { data } = await axios.put(
    `${apiBase()}/projects/${encodeURIComponent(projectName)}/items/rename`,
    { category: categoryPath, from: fromName, to: toName }
  )
  return data.item
}

export async function uploadVirtualImageGroupIcon(projectName, categoryPath, groupName, file) {
  const form = new FormData()
  form.append('category', categoryPath)
  form.append('group', groupName)
  form.append('file', file)
  const { data } = await axios.post(
    `${apiBase()}/projects/${encodeURIComponent(projectName)}/groups/icon`,
    form
  )
  return data.item
}

export async function uploadVirtualImageItemImages(projectName, category, item, files) {
  const form = new FormData()
  form.append('category', category)
  form.append('item', item)
  for (const file of files) {
    form.append('file', file)
  }
  const { data } = await axios.post(
    `${apiBase()}/projects/${encodeURIComponent(projectName)}/items/images`,
    form
  )
  return data.item
}

export const DEFAULT_VIRTUAL_IMAGE_CATEGORY_LABELS = {
  role: '角色',
  scene: '场景',
  prop: '道具',
  reference: '参考',
}

export function normalizeCategoryList(categories) {
  if (Array.isArray(categories)) {
    return categories.map((name) => String(name).trim()).filter(Boolean)
  }
  if (categories && typeof categories === 'object') {
    return Object.keys(DEFAULT_VIRTUAL_IMAGE_CATEGORY_LABELS)
      .map((key) => String(categories[key] || '').trim())
      .filter(Boolean)
  }
  return []
}

function withIconCacheBust(iconUrl) {
  if (!iconUrl) return iconUrl
  const sep = iconUrl.includes('?') ? '&' : '?'
  return `${iconUrl}${sep}t=${Date.now()}`
}

/**
 * Fetch all virtual-image templates grouped by category
 * @param {string} [project] - optional project name to scope the request
 * Returns { role: [], scene: [], prop: [], reference: [] }
 * Each item: { id, name, category, covers: [url, ...] }
 */
export async function fetchVirtualImageTemplates(project, path) {
  const params = {}
  if (project) params.project = project
  if (path) params.path = path
  const { data } = await axios.get(`${apiBase()}/list`, { params })
  return data
}

/**
 * Build a cover URL for a specific image
 * @param {string} [project] - optional project name
 */
export function virtualImageUrl(category, subfolder, filename, project) {
  const prefix = project ? `/${encodeURIComponent(project)}` : ''
  return `${imageBase()}${prefix}/${category}/${encodeURIComponent(subfolder)}/${encodeURIComponent(filename)}`
}

export { withIconCacheBust }
