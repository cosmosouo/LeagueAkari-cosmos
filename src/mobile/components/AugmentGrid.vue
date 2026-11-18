<template>
  <div class="augment-controls">
    <div class="rarity-tabs" :aria-label="t('lanMobile.phone.rarity')">
      <button
        v-for="option in rarityOptions"
        :key="option.value"
        :class="{ selected: rarity === option.value }"
        :aria-pressed="rarity === option.value"
        @click="rarity = option.value"
      >
        {{ option.label }}
      </button>
    </div>
    <input
      v-model="search"
      type="search"
      :placeholder="t('lanMobile.phone.searchAugment')"
      :aria-label="t('lanMobile.phone.searchAugment')"
      class="compact-search"
    />
  </div>
  <div class="augment-grid">
    <button
      v-for="augment in visibleAugments"
      :key="augment.id"
      class="augment-tile"
      :class="`rarity-${augment.rarity}`"
      :aria-label="`#${augment.rank} ${augment.name}`"
      @click="$emit('inspect', [augment])"
    >
      <span class="ranked-icon"
        ><MobileIcon :resource="augment" :token="token" /><span class="rank-badge">{{
          augment.rank
        }}</span></span
      >
      <span class="augment-name">{{ augment.name }}</span>
    </button>
  </div>
  <div v-if="!visibleAugments.length" class="empty-state">{{ t('lanMobile.phone.empty') }}</div>
</template>

<script setup lang="ts">
import type { MobileAugment, MobileResource } from '@shared/lan-mobile'
import { useTranslation } from 'i18next-vue'
import { computed, ref, watch } from 'vue'

import MobileIcon from './MobileIcon.vue'

const props = defineProps<{ augments: MobileAugment[]; token: string }>()
defineEmits<{ inspect: [resources: MobileResource[]] }>()
const { t } = useTranslation()
const rarity = ref('all')
const search = ref('')
const rarityOptions = computed(() => [
  { value: 'all', label: t('lanMobile.phone.all') },
  ...(['kSilver', 'kGold', 'kPrismatic'] as const)
    .filter((value) => props.augments.some((augment) => augment.rarity === value))
    .map((value) => ({ value, label: t(`lanMobile.phone.rarities.${value}`) }))
])
const visibleAugments = computed(() =>
  props.augments.filter(
    (augment) =>
      (rarity.value === 'all' || augment.rarity === rarity.value) &&
      augment.name.toLowerCase().includes(search.value.trim().toLowerCase())
  )
)
watch(rarityOptions, (options) => {
  if (!options.some((option) => option.value === rarity.value)) rarity.value = 'all'
})
</script>
