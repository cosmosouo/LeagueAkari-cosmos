<template>
  <img
    v-if="source && !failed"
    :src="source"
    :alt="resource.name"
    class="resource-icon"
    loading="lazy"
    @error="failed = true"
  />
  <span
    v-else
    class="resource-icon resource-icon--missing"
    role="img"
    :aria-label="resource.name"
    >{{ resource.name.slice(0, 1) }}</span
  >
</template>

<script setup lang="ts">
import type { MobileResource } from '@shared/lan-mobile'
import { computed, ref, watch } from 'vue'

const props = defineProps<{ resource: MobileResource; token: string }>()
const failed = ref(false)
const source = computed(() => {
  const icon = props.resource.icon
  if (!icon) return null
  if (icon.source === 'url') return icon.path
  return `/api/asset?path=${encodeURIComponent(icon.path)}&token=${encodeURIComponent(props.token)}`
})
watch(source, () => {
  failed.value = false
})
</script>
