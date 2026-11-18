<template>
  <dialog ref="dialog" class="resource-dialog" @close="$emit('close')" @click="handleBackdrop">
    <div class="dialog-heading">
      <h2>{{ t('lanMobile.phone.details') }}</h2>
      <button class="icon-button" :aria-label="t('lanMobile.phone.close')" @click="dialog?.close()">
        ×
      </button>
    </div>
    <article v-for="resource in resources" :key="resource.id" class="resource-description">
      <div class="resource-description-heading">
        <MobileIcon :resource="resource" :token="token" />
        <h3>{{ resource.name }}</h3>
      </div>
      <p>{{ resource.description || t('lanMobile.phone.noDescription') }}</p>
    </article>
  </dialog>
</template>

<script setup lang="ts">
import type { MobileResource } from '@shared/lan-mobile'
import { useTranslation } from 'i18next-vue'
import { nextTick, useTemplateRef, watch } from 'vue'

import MobileIcon from './MobileIcon.vue'

const props = defineProps<{ resources: MobileResource[] | null; token: string }>()
defineEmits<{ close: [] }>()
const { t } = useTranslation()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
watch(
  () => props.resources,
  async (value) => {
    await nextTick()
    if (value && !dialog.value?.open) dialog.value?.showModal()
    else if (!value) dialog.value?.close()
  }
)
const handleBackdrop = (event: MouseEvent) => {
  if (event.target !== dialog.value) return
  const bounds = dialog.value!.getBoundingClientRect()
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    dialog.value!.close()
}
</script>
