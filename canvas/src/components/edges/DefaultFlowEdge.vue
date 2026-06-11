<template>
  <BaseEdge :path="path" :style="edgeStyle" :marker-end="markerEnd" :marker-start="markerStart" />
</template>

<script setup>
import { computed } from 'vue'
import { BaseEdge, getBezierPath } from '@vue-flow/core'

const props = defineProps({
  sourceX: Number,
  sourceY: Number,
  targetX: Number,
  targetY: Number,
  sourcePosition: String,
  targetPosition: String,
  markerEnd: String,
  markerStart: String,
})

const path = computed(() => {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  })
  return edgePath
})

const edgeStyle = computed(() => ({
  stroke: 'var(--edge-line-base)',
  strokeWidth: 2,
}))
</script>
