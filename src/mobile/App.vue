<template>
  <main class="mobile-app">
    <header class="topbar">
      <div class="brand">
        League Akari <span>{{ t('lanMobile.phone.title') }}</span>
      </div>
      <div class="connection-badges">
        <span :class="{ connected: snapshot?.connected }">{{
          t(
            snapshot?.connected
              ? 'lanMobile.phone.clientConnected'
              : 'lanMobile.phone.clientDisconnected'
          )
        }}</span
        ><span :class="{ connected: synchronized }">{{
          t(synchronized ? 'lanMobile.phone.synchronized' : 'lanMobile.phone.reconnecting')
        }}</span>
      </div>
    </header>
    <div v-if="connectionError" class="connection-warning" role="status">
      <p>
        {{
          t(
            connectionError === 'unauthorized'
              ? 'lanMobile.phone.invalidAddress'
              : 'lanMobile.phone.offline'
          )
        }}
      </p>
      <button v-if="connectionError !== 'unauthorized'" class="secondary-button" @click="connect">
        {{ t('lanMobile.phone.reconnect') }}
      </button>
    </div>
    <template v-if="view && snapshot">
      <section class="controls data-card">
        <div class="primary-controls">
          <select
            :value="view.source"
            :disabled="disabled"
            :aria-label="t('lanMobile.phone.source')"
            @change="changeSource"
          >
            <option
              v-for="option in view.filters.sources"
              :key="option.value"
              :value="option.value"
              :disabled="option.disabled"
            >
              {{ option.label }}
            </option>
          </select>
          <select
            :value="view.mode"
            :disabled="disabled"
            :aria-label="t('lanMobile.phone.mode')"
            @change="changeMode"
          >
            <option v-for="option in view.filters.modes" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
          <button
            class="icon-button"
            :disabled="disabled"
            :aria-label="t('lanMobile.phone.refresh')"
            @click="handleCommand({ type: 'refresh' })"
          >
            ↻
          </button>
          <button
            class="secondary-button champions-button"
            :disabled="disabled"
            @click="
              handleCommand({
                type: 'tab',
                value: view.tab === 'champions' && view.champion ? 'champion' : 'champions'
              })
            "
          >
            {{
              t(
                view.tab === 'champions' && view.champion
                  ? 'lanMobile.phone.currentChampion'
                  : 'lanMobile.phone.champions'
              )
            }}
          </button>
        </div>
        <button
          v-if="filterRows.length"
          class="filter-summary"
          :aria-expanded="filtersExpanded"
          aria-controls="mobile-filter-controls"
          @click="filtersExpanded = !filtersExpanded"
        >
          <span>{{ filterSummary }}</span>
          <span>{{ t('lanMobile.phone.filters') }} {{ filtersExpanded ? '▴' : '▾' }}</span>
        </button>
        <div
          v-if="filterRows.length && filtersExpanded"
          id="mobile-filter-controls"
          class="filter-controls"
        >
          <label v-for="row in filterRows" :key="row.type"
            ><span>{{ row.label }}</span
            ><select
              :value="row.value"
              :disabled="disabled"
              @change="changeFilter(row.type, $event)"
            >
              <option v-for="option in row.options" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select></label
          >
        </div>
        <div v-if="view.source !== view.effectiveSource && view.effectiveSource" class="muted">
          {{ t('lanMobile.phone.effectiveSource', { source: view.effectiveSource }) }}
        </div>
      </section>
      <div
        v-if="view.loading || busy"
        class="loading-bar"
        role="status"
        :aria-label="t('lanMobile.phone.loading')"
      />
      <div v-if="view.unavailable" class="empty-state">
        {{ t('lanMobile.phone.dataUnavailable') }}
      </div>
      <template v-else-if="view.tab === 'champions'">
        <nav v-if="view.augments.length" class="section-nav">
          <button
            :class="{ selected: overviewSection === 'champions' }"
            @click="overviewSection = 'champions'"
          >
            {{ t('lanMobile.phone.champions') }}</button
          ><button
            :class="{ selected: overviewSection === 'augments' }"
            @click="overviewSection = 'augments'"
          >
            {{ t('lanMobile.phone.section.augments') }}
          </button>
        </nav>
        <section v-if="overviewSection === 'augments' && view.augments.length" class="data-card">
          <AugmentGrid :augments="view.augments" :token="token" @inspect="inspected = $event" />
        </section>
        <template v-else>
          <input
            v-model="championSearch"
            type="search"
            class="champion-search"
            :placeholder="t('lanMobile.phone.searchChampion')"
            :aria-label="t('lanMobile.phone.searchChampion')"
          />
          <div class="champion-grid">
            <button
              v-for="champion in visibleChampions"
              :key="champion.id"
              class="champion-tile"
              :disabled="disabled"
              @click="handleCommand({ type: 'champion', value: champion.id })"
            >
              <span class="ranked-icon"
                ><MobileIcon :resource="champion" :token="token" /><span
                  v-if="champion.rank"
                  class="rank-badge"
                  >#{{ champion.rank }}</span
                ></span
              ><span>{{ champion.name }}</span>
            </button>
          </div>
          <div v-if="!visibleChampions.length && !view.loading" class="empty-state">
            {{ t('lanMobile.phone.empty') }}
          </div>
        </template>
      </template>
      <ChampionDetails
        v-else-if="view.champion"
        :view="view"
        :snapshot="snapshot"
        :token="token"
        :disabled="disabled"
        @command="handleCommand"
        @inspect="inspected = $event"
      />
      <div v-else class="empty-state">
        {{ t(view.loading ? 'lanMobile.phone.loading' : 'lanMobile.phone.empty') }}
      </div>
    </template>
    <div v-else-if="!connectionError" class="empty-state">
      {{ t(snapshot ? 'lanMobile.phone.waitingForDesktop' : 'lanMobile.phone.connecting') }}
    </div>
    <ResourceDetails :resources="inspected" :token="token" @close="inspected = null" />
    <div v-if="toast" class="toast" :class="{ 'toast-error': toast.error }" role="status">
      {{ toast.text }}
    </div>
  </main>
</template>

<script setup lang="ts">
import type {
  ChampionDataMode,
  ChampionDataPosition,
  ChampionDataSourceId
} from '@shared/data-adapter/champion-data'
import type { LanMobileCommand, MobileResource } from '@shared/lan-mobile'
import i18next from 'i18next'
import { useTranslation } from 'i18next-vue'
import { computed, onScopeDispose, ref, watch } from 'vue'

import AugmentGrid from './components/AugmentGrid.vue'
import ChampionDetails from './components/ChampionDetails.vue'
import MobileIcon from './components/MobileIcon.vue'
import ResourceDetails from './components/ResourceDetails.vue'
import { useMobileConnection } from './connection'

const { t } = useTranslation()
const { token, snapshot, synchronized, busy, connectionError, connect, sendCommand } =
  useMobileConnection()
const view = computed(() => snapshot.value?.view)
const disabled = computed(() => !synchronized.value || busy.value || !!view.value?.loading)
const championSearch = ref('')
const filtersExpanded = ref(false)
const overviewSection = ref<'champions' | 'augments'>('champions')
const inspected = ref<MobileResource[] | null>(null)
const toast = ref<{ text: string; error: boolean } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

const visibleChampions = computed(() => {
  const query = championSearch.value.trim().toLowerCase()
  return (view.value?.champions ?? []).filter(
    (champion) =>
      !query ||
      [champion.name, ...champion.searchKeywords].some((value) =>
        value.toLowerCase().includes(query)
      )
  )
})
const filterRows = computed(() => {
  const value = view.value
  if (!value) return []
  return [
    { type: 'region' as const, value: value.region, options: value.filters.regions },
    { type: 'tier' as const, value: value.tier, options: value.filters.tiers },
    { type: 'patch' as const, value: value.patch ?? '', options: value.filters.patches },
    { type: 'position' as const, value: value.position, options: value.filters.positions }
  ]
    .filter((row) => row.options.length)
    .map((row) => ({ ...row, label: t(`lanMobile.phone.${row.type}`) }))
})
const filterSummary = computed(() =>
  filterRows.value
    .map((row) => row.options.find((option) => option.value === row.value)?.label)
    .filter(Boolean)
    .join(' · ')
)

watch(
  () => view.value?.locale,
  (locale) => {
    if (locale) void i18next.changeLanguage(locale.startsWith('zh') ? 'zh-CN' : 'en')
  }
)
watch(
  () => [view.value?.championId, view.value?.mode, view.value?.tab],
  () => {
    inspected.value = null
  }
)
const handleCommand = async (command: LanMobileCommand) => {
  if (disabled.value) return
  const result = await sendCommand(command)
  if (!result.ok || command.type === 'apply') {
    if (toastTimer) clearTimeout(toastTimer)
    toast.value = {
      text: result.ok ? t('lanMobile.phone.applied') : t(`lanMobile.errors.${result.reason}`),
      error: !result.ok
    }
    toastTimer = setTimeout(() => {
      toast.value = null
    }, 5_000)
  }
}
const selectedValue = (event: Event) => (event.target as HTMLSelectElement).value
const changeSource = (event: Event) =>
  handleCommand({ type: 'source', value: selectedValue(event) as ChampionDataSourceId })
const changeMode = (event: Event) =>
  handleCommand({ type: 'mode', value: selectedValue(event) as ChampionDataMode })
const changeFilter = (type: 'region' | 'tier' | 'patch' | 'position', event: Event) => {
  const value = selectedValue(event)
  return type === 'position'
    ? handleCommand({ type, value: value as ChampionDataPosition })
    : handleCommand({ type, value })
}
onScopeDispose(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
</script>
