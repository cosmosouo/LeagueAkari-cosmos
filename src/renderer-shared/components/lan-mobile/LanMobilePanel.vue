<template>
  <NScrollbar class="max-h-[70vh] w-80">
    <div class="px-1">
      <div class="flex items-center justify-between gap-2 pb-1">
        <span class="text-sm font-bold">{{ t('lanMobile.title') }}</span
        ><span
          class="text-xs"
          :class="
            store.state.running
              ? 'text-emerald-600 dark:text-emerald-300'
              : 'text-black/50 dark:text-white/50'
          "
          >{{ t(store.state.running ? 'lanMobile.running' : 'lanMobile.disabled') }}</span
        >
      </div>
      <LanMobileSettings compact />
    </div>
  </NScrollbar>
</template>

<script setup lang="ts">
import { useLanMobileStore } from '@renderer-shared/shards/lan-mobile/store'
import { useTranslation } from 'i18next-vue'
import { NScrollbar } from 'naive-ui'

import LanMobileSettings from './LanMobileSettings.vue'

const { t } = useTranslation()
const store = useLanMobileStore()
</script>
