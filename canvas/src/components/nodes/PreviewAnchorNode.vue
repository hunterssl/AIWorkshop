<template>
  <div class="preview-anchor" />
  <Handle type="target" :position="Position.Left" id="left" class="!bg-[var(--accent-color)]" />
  <Handle type="source" :position="Position.Right" id="right" class="!bg-[var(--accent-color)]" />
</template>

<script setup>
import { Handle, Position } from '@vue-flow/core'
</script>

<style scoped>
.preview-anchor {
  width: 16px;
  height: 16px;
  opacity: 0;
  pointer-events: none;
}
</style>
