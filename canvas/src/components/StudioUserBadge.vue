<template>
  <div ref="rootRef" class="rh-user-badge" @click.stop>
    <button
      type="button"
      class="rh-user-badge__btn"
      :class="{ 'is-logged-in': authed }"
      :aria-haspopup="authed ? 'menu' : 'dialog'"
      :aria-expanded="dropdownOpen ? 'true' : 'false'"
      @click="handleBadgeClick"
    >
      <svg class="rh-user-badge__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
      <span>{{ badgeLabel }}</span>
    </button>
    <div v-if="menuAvailable" class="rh-user-badge__dropdown" :class="{ 'is-hidden': !dropdownOpen }" role="menu">
      <button type="button" class="rh-user-badge__dropdown-item" role="menuitem" @click="openApiSettings">
        API 设置
      </button>
      <button
        v-if="multiUserEnabled && authed"
        type="button"
        class="rh-user-badge__dropdown-item"
        role="menuitem"
        @click="handleLogout"
      >
        退出登录
      </button>
    </div>

    <n-modal v-model:show="showLoginModal" preset="card" title="用户登录" class="w-[400px]" :mask-closable="true">
      <p class="text-sm text-[var(--text-secondary)] mb-4">
        登录后，你的任务与产出将与其他用户分开保存。
      </p>
      <div class="space-y-3">
        <div>
          <label class="text-xs text-[var(--text-secondary)] mb-1 block">用户名</label>
          <input
            v-model="loginUsername"
            type="text"
            maxlength="32"
            autocomplete="username"
            placeholder="请输入用户名"
            class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            @keydown.enter="submitLogin"
          />
        </div>
        <div>
          <label class="text-xs text-[var(--text-secondary)] mb-1 block">密码</label>
          <input
            v-model="loginPassword"
            type="password"
            maxlength="64"
            autocomplete="current-password"
            placeholder="请输入密码"
            class="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-color)]"
            @keydown.enter="submitLogin"
          />
        </div>
        <button
          type="button"
          class="w-full py-2 rounded-lg bg-[var(--accent-color)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium"
          :disabled="loggingIn"
          @click="submitLogin"
        >
          {{ loggingIn ? '登录中...' : '确认登录' }}
        </button>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NModal } from 'naive-ui'

const USER_KEY = 'rh_studio_user_id'
const TOKEN_KEY = 'rh_studio_session_token'
const AUTH_KEY = 'rh_studio_authed_user_id'
const MIN_PASSWORD_LENGTH = 6

const rootRef = ref(null)
const usersMap = ref({ default: 'default' })
const multiUserEnabled = ref(false)
const userId = ref('default')
const authed = ref(false)
const dropdownOpen = ref(false)
const showLoginModal = ref(false)
const loginUsername = ref('')
const loginPassword = ref('')
const loggingIn = ref(false)

const displayName = computed(() => usersMap.value[userId.value] || userId.value || 'default')

const menuAvailable = computed(() => !multiUserEnabled.value || authed.value)

const badgeLabel = computed(() => {
  if (!multiUserEnabled.value) return '默认用户'
  return authed.value ? displayName.value : '登录'
})

function readAuthState() {
  try {
    userId.value = localStorage.getItem(USER_KEY) || 'default'
    const token = sessionStorage.getItem(TOKEN_KEY) || ''
    const authedId = sessionStorage.getItem(AUTH_KEY) || ''
    authed.value = Boolean(token && userId.value && authedId === userId.value)
  } catch {
    authed.value = false
  }
}

function resolveUserId(usernameOrId) {
  const text = String(usernameOrId || '').trim()
  if (!text) return ''
  if (usersMap.value[text]) return text
  const lower = text.toLowerCase()
  for (const [id, name] of Object.entries(usersMap.value)) {
    const label = String(name || '').trim()
    if (label === text || label.toLowerCase() === lower) return id
    if (String(id) === text) return id
  }
  return ''
}

async function loadUsers() {
  try {
    const res = await fetch('/users')
    const data = await res.json()
    if (data?.users && typeof data.users === 'object' && Object.keys(data.users).length) {
      multiUserEnabled.value = true
      usersMap.value = data.users
      readAuthState()
      if (!usersMap.value[userId.value]) {
        userId.value = Object.keys(usersMap.value)[0] || 'default'
        localStorage.setItem(USER_KEY, userId.value)
      }
    } else {
      multiUserEnabled.value = false
      userId.value = 'default'
    }
  } catch {
    multiUserEnabled.value = false
    userId.value = 'default'
  }
  readAuthState()
}

function handleBadgeClick() {
  if (!multiUserEnabled.value) {
    dropdownOpen.value = !dropdownOpen.value
    return
  }
  if (authed.value) {
    dropdownOpen.value = !dropdownOpen.value
    return
  }
  loginUsername.value = displayName.value !== 'default' ? displayName.value : ''
  loginPassword.value = ''
  showLoginModal.value = true
}

function openApiSettings() {
  dropdownOpen.value = false
  window.RhApiSettings?.open?.()
}

async function submitLogin() {
  const id = resolveUserId(loginUsername.value)
  const pwd = String(loginPassword.value || '')
  if (!String(loginUsername.value || '').trim()) {
    window.$message?.warning('请输入用户名')
    return
  }
  if (!id) {
    window.$message?.warning('用户名不存在，请重新选择')
    return
  }
  if (pwd.length < MIN_PASSWORD_LENGTH) {
    window.$message?.warning(`密码至少 ${MIN_PASSWORD_LENGTH} 位`)
    return
  }
  loggingIn.value = true
  try {
    const res = await fetch('/rh/api/studio/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: id, password: pwd }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || '登录失败')
    const token = String(data?.session_token || data?.token || '').trim()
    if (!token) throw new Error('登录失败：未返回会话')
    localStorage.setItem(USER_KEY, id)
    sessionStorage.setItem(TOKEN_KEY, token)
    sessionStorage.setItem(AUTH_KEY, id)
    userId.value = id
    authed.value = true
    showLoginModal.value = false
    window.RhStudioAuth?.notifyAuthChange?.()
    window.$message?.success(`已登录：${displayName.value}`)
  } catch (err) {
    window.$message?.error(err.message || '登录失败')
  } finally {
    loggingIn.value = false
  }
}

async function handleLogout() {
  dropdownOpen.value = false
  const token = sessionStorage.getItem(TOKEN_KEY) || ''
  try {
    if (token) {
      await fetch('/rh/api/studio/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'rh-studio-session': token },
      })
    }
  } catch {
    // ignore
  }
  sessionStorage.removeItem(AUTH_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  authed.value = false
  window.RhStudioAuth?.notifyAuthChange?.()
  window.$message?.success('已退出登录')
}

function onDocumentClick(event) {
  if (!rootRef.value?.contains(event.target)) {
    dropdownOpen.value = false
  }
}

function onAuthChange() {
  readAuthState()
}

function onOpenApiSettings() {
  openApiSettings()
}

onMounted(async () => {
  await loadUsers()
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('rh-studio-auth-change', onAuthChange)
  window.addEventListener('storage', onAuthChange)
  window.addEventListener('rh-open-api-settings', onOpenApiSettings)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('rh-studio-auth-change', onAuthChange)
  window.removeEventListener('storage', onAuthChange)
  window.removeEventListener('rh-open-api-settings', onOpenApiSettings)
})
</script>
