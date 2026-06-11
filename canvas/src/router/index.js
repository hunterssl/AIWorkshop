/**
 * Router configuration | 路由配置
 */
import { createRouter, createWebHistory } from 'vue-router'

const CANVAS_BASE = '/rh/canvas2'

function fixMisplacedCanvasPath() {
  const { pathname, search, hash } = window.location
  const markerIndex = pathname.indexOf(CANVAS_BASE)
  if (markerIndex <= 0) return

  const suffix = pathname.slice(markerIndex + CANVAS_BASE.length) || '/'
  window.location.replace(`${CANVAS_BASE}${suffix}${search}${hash}`)
}

fixMisplacedCanvasPath()

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/canvas/:id?',
    name: 'Canvas',
    component: () => import('@/views/Canvas.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(CANVAS_BASE),
  routes,
})

export default router
