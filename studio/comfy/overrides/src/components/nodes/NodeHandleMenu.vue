<template>
  <div class="cs-nhm-anchor">
    <Handle type="source" :position="Position.Right" id="right" class="cs-nhm-handle" />

    <div
      v-if="showHandleHoverZone"
      class="cs-nhm-hover"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <n-icon :size="14" class="cs-nhm-add-icon">
        <AddOutline />
      </n-icon>
      <transition name="cs-nhm-menu-fade">
        <div
          v-if="showMenu"
          class="cs-nhm-menu"
          @mouseenter="handleMenuMouseEnter"
          @mouseleave="handleMenuMouseLeave"
          @mousedown.stop
        >
          <button
            v-for="item in menuItems"
            :key="item.type"
            type="button"
            @click.stop="handleCreate(item)"
            class="cs-nhm-menu-item"
          >
            <n-icon :size="14" class="cs-nhm-menu-icon">
              <component :is="item.icon" />
            </n-icon>
            <span class="cs-nhm-menu-label">{{ item.label }}</span>
          </button>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NIcon } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'

const props = defineProps({
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true },
  visible: { type: Boolean },
  dotColor: { type: String, default: 'var(--accent-color)' },
  operations: { type: Array, default: null },
})

const emit = defineEmits(['select'])

const showMenu = ref(false)
let hideTimeout = null

const handleMouseEnter = () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  showMenu.value = true
}

const handleMouseLeave = () => {
  hideTimeout = setTimeout(() => {
    showMenu.value = false
  }, 150)
}

const handleMenuMouseEnter = () => {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  showMenu.value = true
}

const handleMenuMouseLeave = () => {
  hideTimeout = setTimeout(() => {
    showMenu.value = false
  }, 150)
}

const menuItems = computed(() => props.operations || [])

const showHandleHoverZone = computed(() => props.operations && props.operations.length > 0)

const handleCreate = (item) => {
  emit('select', item)
  showMenu.value = false
}
</script>

<style>
.cs-nhm-handle {
  width: 16px !important;
  height: 16px !important;
}

.cs-nhm-anchor {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translate(50%, -50%);
  z-index: 100;
}

.cs-nhm-hover {
  position: absolute;
  left: 50%;
  top: -30px;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  background: var(--bg-tertiary, #2a2a3e);
  border: 1px solid var(--border-color, #444);
  opacity: 1;
  pointer-events: auto;
  transition: all 0.2s ease;
}

.cs-nhm-anchor:hover .cs-nhm-hover {
  background: var(--bg-tertiary, #2a2a3e);
  border-color: var(--border-color, #444);
}

.cs-nhm-hover:hover {
  background: var(--accent-color, #8b5cf6);
  border-color: var(--accent-color, #8b5cf6);
  transform: translate(-50%, -50%) scale(1.1);
}

.cs-nhm-add-icon {
  color: var(--text-secondary, #999);
  transition: color 0.2s ease;
}

.cs-nhm-hover:hover .cs-nhm-add-icon {
  color: white;
}

.cs-nhm-menu {
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  background: var(--bg-secondary, #1e1e2e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
  z-index: 200;
}

.cs-nhm-menu-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-secondary, #999);
  transition: all 0.15s ease;
  cursor: pointer;
  border: none;
  background: none;
}

.cs-nhm-menu-item:hover {
  background: var(--accent-color, #8b5cf6);
  color: white;
}

.cs-nhm-menu-item:hover .cs-nhm-menu-icon {
  color: white;
}

.cs-nhm-menu-label {
  font-size: 11px;
}

.cs-nhm-menu-fade-enter-active,
.cs-nhm-menu-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.cs-nhm-menu-fade-enter-from,
.cs-nhm-menu-fade-leave-to {
  opacity: 0;
  transform: translateX(-4px);
}
</style>
