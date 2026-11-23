<template>
  <div v-if="champion" class="champion-details">
    <div class="champion-heading">
      <span class="ranked-icon champion-portrait"
        ><MobileIcon :resource="champion" :token="token" /><span
          v-if="champion.rank"
          class="rank-badge"
          >#{{ champion.rank }}</span
        ></span
      >
      <div class="champion-name-block">
        <h1>{{ champion.name }}</h1>
        <span
          >{{ view.filters.modes.find((option) => option.value === view.mode)?.label
          }}<template v-if="champion.tier !== null"> · {{ tierText }}</template></span
        >
      </div>
      <button
        v-if="champion.runes.length || champion.summonerSpells.length"
        class="primary-button apply-all"
        :disabled="disabled || !snapshot.canApply"
        :title="applyUnavailableText"
        @click="apply('all', 0)"
      >
        {{ t('lanMobile.phone.applyAll') }}
      </button>
    </div>
    <p v-if="buildReference || isBuildReferenceUnavailable" class="muted build-reference">
      {{ buildReferenceText
      }}<span v-if="buildReference?.patch"> · {{ buildReference.patch }}</span>
    </p>
    <nav class="section-nav" :aria-label="t('lanMobile.phone.sections')">
      <button
        v-for="option in sectionOptions"
        :key="option"
        :class="{ selected: section === option }"
        :aria-pressed="section === option"
        @click="section = option"
      >
        {{ t(`lanMobile.phone.section.${option}`) }}
      </button>
    </nav>

    <template v-if="section === 'all' || section === 'items'">
      <section v-for="group in champion.items" :key="group.slot" class="data-card item-section">
        <h2>{{ t(`lanMobile.phone.itemSlots.${group.slot}`) }}</h2>
        <div
          class="item-grid"
          :class="{ 'item-grid--builds': group.options.some((option) => option.items.length > 1) }"
        >
          <button
            v-for="(option, index) in group.options"
            :key="index"
            class="item-tile"
            :aria-label="t('lanMobile.phone.itemRecommendation', { rank: option.rank })"
            @click="$emit('inspect', option.items)"
          >
            <span class="item-rank">#{{ option.rank }}</span>
            <span class="item-icons"
              ><MobileIcon
                v-for="(item, itemIndex) in option.items"
                :key="`${item.id}-${itemIndex}`"
                :resource="item"
                :token="token"
            /></span>
          </button>
        </div>
      </section>
    </template>

    <section
      v-if="champion.augments.length && (section === 'all' || section === 'augments')"
      class="data-card"
    >
      <h2>{{ t('lanMobile.phone.section.augments') }}</h2>
      <AugmentGrid
        :augments="champion.augments"
        :token="token"
        @inspect="$emit('inspect', $event)"
      />
    </section>

    <template v-if="section === 'all' || section === 'runes'">
      <section v-if="champion.runes.length" class="data-card">
        <h2>{{ t('lanMobile.phone.runes') }}</h2>
        <div class="loadout-list">
          <div v-for="(page, index) in champion.runes" :key="index" class="loadout-row">
            <span class="loadout-rank">#{{ page.rank }}</span>
            <div class="rune-icons">
              <button
                v-for="perk in page.perks"
                :key="perk.id"
                class="plain-icon-button"
                :aria-label="perk.name"
                @click="$emit('inspect', [perk])"
              >
                <MobileIcon :resource="perk" :token="token" />
              </button>
            </div>
            <button
              class="primary-button small-button"
              :disabled="disabled || !snapshot.canApply"
              :title="applyUnavailableText"
              @click="apply('runes', index)"
            >
              {{ t('lanMobile.phone.apply') }}
            </button>
          </div>
        </div>
      </section>
      <section v-if="champion.summonerSpells.length" class="data-card">
        <h2>{{ t('lanMobile.phone.spells') }}</h2>
        <div class="spell-grid">
          <div
            v-for="(recommendation, index) in champion.summonerSpells"
            :key="index"
            class="spell-option"
          >
            <span class="loadout-rank">#{{ recommendation.rank }}</span>
            <div class="spell-icons">
              <button
                v-for="spell in recommendation.spells"
                :key="spell.id"
                class="plain-icon-button"
                :aria-label="spell.name"
                @click="$emit('inspect', [spell])"
              >
                <MobileIcon :resource="spell" :token="token" />
              </button>
            </div>
            <button
              class="primary-button small-button"
              :disabled="disabled || !snapshot.canApply"
              :title="applyUnavailableText"
              @click="apply('spells', index)"
            >
              {{ t('lanMobile.phone.apply') }}
            </button>
          </div>
        </div>
      </section>
      <p
        v-if="!snapshot.canApply && (champion.runes.length || champion.summonerSpells.length)"
        class="muted apply-note"
      >
        {{ applyUnavailableText }}
      </p>
    </template>

    <section
      v-if="champion.abilities.length && (section === 'all' || section === 'skills')"
      class="data-card"
    >
      <h2>{{ t('lanMobile.phone.section.skills') }}</h2>
      <div v-for="(ability, index) in champion.abilities" :key="index" class="ability-row">
        <span class="loadout-rank">#{{ ability.rank }}</span>
        <div class="ability-build">
          <div class="ability-priority">
            <span
              v-for="(key, keyIndex) in ability.priority"
              :key="keyIndex"
              class="ability-key"
              :class="`ability-${key}`"
              >{{ key }}</span
            >
          </div>
          <div class="ability-order">
            <span
              v-for="(key, level) in ability.order"
              :key="level"
              class="ability-key"
              :class="`ability-${key}`"
              >{{ key }}</span
            >
          </div>
        </div>
      </div>
    </section>
    <div v-if="sectionOptions.length === 1" class="empty-state">
      {{ t('lanMobile.phone.empty') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  LanMobileApplyCommand,
  LanMobileCommand,
  LanMobileSnapshot,
  LanMobileView,
  MobileResource
} from '@shared/lan-mobile'
import { useTranslation } from 'i18next-vue'
import { computed, ref, watch } from 'vue'

import AugmentGrid from './AugmentGrid.vue'
import MobileIcon from './MobileIcon.vue'

const props = defineProps<{
  view: LanMobileView
  snapshot: LanMobileSnapshot
  token: string
  disabled: boolean
}>()
const emit = defineEmits<{
  command: [command: LanMobileCommand]
  inspect: [resources: MobileResource[]]
}>()
const { t } = useTranslation()
const champion = computed(() => props.view.champion)
const buildReference = computed(() => champion.value?.buildReference)
const buildReferenceText = computed(() => {
  const reference = buildReference.value
  if (!reference) return t('lanMobile.phone.buildReferenceUnavailable')
  return t('lanMobile.phone.buildReference', {
    source: props.view.filters.sources.find((option) => option.value === reference.source)?.label,
    mode: props.view.filters.modes.find((option) => option.value === reference.mode)?.label
  })
})
const isBuildReferenceUnavailable = computed(
  () =>
    props.view.mode === 'aram_mayhem' &&
    props.view.effectiveSource === 'opgg' &&
    !buildReference.value
)
type Section = 'all' | 'items' | 'augments' | 'runes' | 'skills'
const section = ref<Section>('all')
const sectionOptions = computed<Section[]>(() => {
  const value = champion.value
  return [
    'all',
    ...(value?.items.length ? ['items' as const] : []),
    ...(value?.augments.length ? ['augments' as const] : []),
    ...(value?.runes.length || value?.summonerSpells.length ? ['runes' as const] : []),
    ...(value?.abilities.length ? ['skills' as const] : [])
  ]
})
watch(
  () => props.view.mode,
  () => {
    section.value = champion.value?.augments.length
      ? 'augments'
      : champion.value?.items.length
        ? 'items'
        : 'all'
  },
  { immediate: true }
)
watch(sectionOptions, (options) => {
  if (!options.includes(section.value)) section.value = options[1] ?? 'all'
})
const tierText = computed(() => {
  const tier = champion.value?.tier
  if (tier === 0 || tier === 'OP') return 'OP'
  return typeof tier === 'number' ? `T${tier}` : tier
})
const applyUnavailableText = computed(() =>
  props.snapshot.applyUnavailableReason
    ? t(`lanMobile.errors.${props.snapshot.applyUnavailableReason}`)
    : ''
)
const apply = (target: LanMobileApplyCommand['target'], index: number) => {
  if (!champion.value || !props.snapshot.canApply || props.disabled) return
  emit('command', {
    type: 'apply',
    target,
    index,
    championId: champion.value.id,
    revision: props.snapshot.revision
  })
}
</script>
