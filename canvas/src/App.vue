<script setup>
/**
 * Root App component | 根组件
 * Provides naive-ui config and router view
 */
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme } from 'naive-ui'
import { isDark } from './stores/theme'

// Naive UI theme based on dark mode | 基于深色模式的 Naive UI 主题
const theme = computed(() => isDark.value ? darkTheme : null)

// 与创作工坊一致的紫/蓝主色（覆盖 Naive UI 默认绿色 Switch 等）
const themeOverrides = computed(() => {
  const primary = isDark.value ? '#60a5fa' : '#7c3aed'
  const primaryHover = isDark.value ? '#3b82f6' : '#6d28d9'
  const primaryPressed = isDark.value ? '#2563eb' : '#5b21b6'

  return {
    common: {
      borderRadius: '12px',
      borderRadiusSmall: '8px',
      primaryColor: primary,
      primaryColorHover: primaryHover,
      primaryColorPressed: primaryPressed,
      primaryColorSuppl: isDark.value ? '#93c5fd' : '#8b5cf6',
    },
    Switch: {
      railColorActive: primary,
      railColor: isDark.value ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.45)',
      buttonColor: '#ffffff',
      loadingColor: primary,
    },
    Dialog: {
      borderRadius: '16px',
      padding: '24px',
    },
    Modal: {
      borderRadius: '16px',
      padding: '24px',
    },
    Card: {
      borderRadius: '16px',
      padding: '24px',
    },
    Button: {
      borderRadiusMedium: '10px',
      borderRadiusSmall: '8px',
      borderRadiusLarge: '12px',
      heightMedium: '36px',
      paddingMedium: '0 16px',
    },
    Input: {
      borderRadius: '10px',
      heightMedium: '36px',
    },
  }
})
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
/* Global app styles handled in style.css */
</style>
