import { nextTick, onMounted, watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { updateNode } from '@/stores/canvas'

/**
 * Let Vue Flow measure node size from visible content.
 */
export function useNodeAutoHeight(nodeId, watchSources = []) {
  const { updateNodeInternals } = useVueFlow()

  const syncNodeSize = () => {
    nextTick(() => {
      updateNode(nodeId, { height: undefined, width: undefined })
      updateNodeInternals(nodeId)
      setTimeout(() => updateNodeInternals(nodeId), 50)
    })
  }

  onMounted(syncNodeSize)

  if (watchSources.length > 0) {
    watch(watchSources, syncNodeSize)
  }

  return { syncNodeSize }
}
