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
 * Fetch all virtual-image templates grouped by category
 * @param {string} [project] - optional project name to scope the request
 * Returns { role: [], scene: [], prop: [], reference: [] }
 * Each item: { id, name, category, covers: [url, ...] }
 */
export async function fetchVirtualImageTemplates(project) {
  const params = project ? { project } : {}
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
