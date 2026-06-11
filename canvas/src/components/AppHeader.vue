<template>
  <!-- App Header | 应用头部 -->
  <header class="flex items-center justify-between px-4 md:px-8 py-4 border-b border-[var(--border-color)]">
    <!-- Left slot | 左侧插槽 -->
    <div class="flex items-center gap-2">
      <slot name="left">
        <!-- Default: empty or logo -->
      </slot>
    </div>

    <!-- Right section | 右侧区域 -->
    <div class="rh-header-actions">
      <!-- Center slot | 中间插槽 -->
      <slot name="center"></slot>

      <StudioUserBadge />

      <!-- Theme toggle | 主题切换 -->
      <button
        type="button"
        @click="toggleTheme"
        class="rh-header-icon-btn"
        :aria-label="isDark ? '切换到亮色模式' : '切换到暗色模式'"
        :title="isDark ? '亮色模式' : '暗色模式'"
      >
        <n-icon :size="20">
          <SunnyOutline v-if="isDark" />
          <MoonOutline v-else />
        </n-icon>
      </button>

      <!-- Right slot | 右侧插槽 -->
      <slot name="right"></slot>
    </div>
  </header>
</template>

<script setup>
/**
 * App Header component | 应用头部组件
 */
import { NIcon } from 'naive-ui'
import { SunnyOutline, MoonOutline } from '@vicons/ionicons5'
import { isDark, toggleTheme } from '../stores/theme'
import StudioUserBadge from './StudioUserBadge.vue'
</script>
