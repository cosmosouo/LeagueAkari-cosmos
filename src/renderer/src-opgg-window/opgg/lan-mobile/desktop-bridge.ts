import { useAkariResourceProvider } from '@renderer-shared/providers/akari-resource'
import { useInstance } from '@renderer-shared/shards'
import { useChampionDataStore } from '@renderer-shared/shards/champion-data/store'
import { LanMobileRenderer } from '@renderer-shared/shards/lan-mobile'
import { useLanMobileStore } from '@renderer-shared/shards/lan-mobile/store'
import { LoggerRenderer } from '@renderer-shared/shards/logger'
import {
  type ChampionDataMode,
  type ChampionDataPosition,
  getChampionDataCapability
} from '@shared/data-adapter/champion-data'
import {
  type LanMobileCommandResult,
  type LanMobileNavigationCommand,
  type LanMobileView,
  type MobileResourceResolver,
  mobileAugmentsFromData,
  mobileChampionDetailsFromData,
  mobileChampionsFromData
} from '@shared/lan-mobile'
import type { ModeType, PositionType, RegionType, TierType } from '@shared/types/opgg'
import { watchDebounced } from '@vueuse/core'
import { useTranslation } from 'i18next-vue'
import { computed } from 'vue'

import type { OpggContext } from '../context'
import {
  useModeOptions,
  usePositionOptions,
  useRegionOptions,
  useTierOptions
} from '../utils/options'

const UNIFIED_POSITIONS: Record<string, ChampionDataPosition> = {
  all: 'all',
  none: 'none',
  top: 'top',
  jungle: 'jungle',
  mid: 'middle',
  adc: 'bottom',
  support: 'utility'
}
const OPGG_POSITIONS: Record<ChampionDataPosition, PositionType> = {
  all: 'all',
  none: 'none',
  top: 'top',
  jungle: 'jungle',
  middle: 'mid',
  bottom: 'adc',
  utility: 'support'
}

function plainDescription(html: string | undefined) {
  if (!html) return undefined
  const element = document.createElement('div')
  element.innerHTML = html.replace(/<br\s*\/?\s*>/gi, '\n')
  return element.textContent?.trim() || undefined
}

export function useLanMobileBridge(context: OpggContext) {
  const lanMobile = useInstance(LanMobileRenderer)
  const store = useLanMobileStore()
  const championDataStore = useChampionDataStore()
  const resources = useAkariResourceProvider()
  const logger = useInstance(LoggerRenderer)
  const { t } = useTranslation()
  const { modeOptions } = useModeOptions(context.preferredSource)
  const { positionOptions } = usePositionOptions()
  const { regionOptions } = useRegionOptions()
  const { tierOptions } = useTierOptions()

  const resolver: MobileResourceResolver = {
    champion: (id) => ({
      name: resources.champions.name(id),
      iconPath: resources.champions.icon(id)?.iconPath,
      searchKeywords: resources.champions.searchKeywords(id)
    }),
    item: (id) => {
      const value = resources.items.display(id)
      return value ? { ...value, description: plainDescription(value.descriptionHtml) } : null
    },
    perk: (id) => {
      const value = resources.perks.display(id)
      return value ? { ...value, description: plainDescription(value.longDescriptionHtml) } : null
    },
    spell: (id) => {
      const value = resources.summonerSpells.display(id)
      return value ? { ...value, description: plainDescription(value.description) } : null
    },
    augment: (id) => {
      const value = resources.augments.display(id)
      return {
        name: resources.augments.name(id),
        iconPath: value?.iconPath,
        rarity: value?.rarity,
        description: plainDescription(value?.tooltipHtml)
      }
    }
  }

  const view = computed<LanMobileView>(() => {
    const mode = context.mode.value as ChampionDataMode
    const capability = getChampionDataCapability(context.preferredSource.value, mode)
    const supports = (filter: 'position' | 'region' | 'tier' | 'patch') =>
      capability?.filters.includes(filter) ?? false
    const details = context.details.value
    return {
      locale: resources.runtime.locale,
      tab: context.currentTab.value,
      championId: context.championId.value,
      source: context.preferredSource.value,
      effectiveSource: context.effectiveSource.value,
      mode,
      position: UNIFIED_POSITIONS[context.position.value] ?? 'none',
      region: context.region.value,
      tier: context.tier.value,
      patch: context.version.value,
      flashPosition: context.flashPosition.value,
      loading: context.isLoading.value,
      unavailable: context.isDataUnavailable.value,
      filters: {
        sources: (['opgg', 'qq101'] as const).map((source) => ({
          label: t(`opgg.filters.sources.${source}`),
          value: source,
          disabled: !championDataStore.availability.sources[source].enabled
        })),
        modes: modeOptions.value,
        positions: supports('position')
          ? positionOptions.value.map((option) => ({
              ...option,
              value: UNIFIED_POSITIONS[option.value]
            }))
          : [],
        regions: supports('region') ? regionOptions.value : [],
        tiers: supports('tier') ? tierOptions.value : [],
        patches: supports('patch')
          ? context.versions.value.map((patch) => ({ label: patch, value: patch }))
          : []
      },
      champions: mobileChampionsFromData(
        context.overview.value,
        resolver,
        supports('position') ? UNIFIED_POSITIONS[context.position.value] : 'all'
      ),
      champion:
        details && details.championId === context.championId.value
          ? mobileChampionDetailsFromData(details, resolver)
          : null,
      augments: mobileAugmentsFromData(
        context.overview.value?.sections.augments ?? [],
        resolver,
        mode
      )
    }
  })

  const publish = async () => {
    if (!store.settings.enabled) return
    await lanMobile.publishView(JSON.parse(JSON.stringify(view.value)))
  }

  watchDebounced(
    () => (store.settings.enabled ? view.value : null),
    () => {
      void publish().catch(() => logger.warn('lan-mobile', 'Could not publish champion data'))
    },
    { immediate: true, debounce: 75, maxWait: 250 }
  )

  const navigate = async (command: LanMobileNavigationCommand): Promise<LanMobileCommandResult> => {
    const options = view.value.filters
    const contains = (values: { value: string; disabled?: boolean }[], value: string) =>
      values.some((option) => option.value === value && !option.disabled)
    switch (command.type) {
      case 'source':
        if (!contains(options.sources, command.value))
          return { ok: false, reason: 'invalid-command' }
        await context.changeSource(command.value)
        break
      case 'mode':
        if (!contains(options.modes, command.value)) return { ok: false, reason: 'invalid-command' }
        await context.changeMode(command.value as ModeType)
        break
      case 'position':
        if (!contains(options.positions, command.value))
          return { ok: false, reason: 'invalid-command' }
        await context.changePosition(OPGG_POSITIONS[command.value])
        break
      case 'region':
        if (!contains(options.regions, command.value))
          return { ok: false, reason: 'invalid-command' }
        await context.changeRegion(command.value as RegionType)
        break
      case 'tier':
        if (!contains(options.tiers, command.value)) return { ok: false, reason: 'invalid-command' }
        await context.changeTier(command.value as TierType)
        break
      case 'patch':
        if (!contains(options.patches, command.value))
          return { ok: false, reason: 'invalid-command' }
        await context.changeVersion(command.value)
        break
      case 'champion':
        if (
          !context.overview.value?.sections.champions.some(
            (item) => item.championId === command.value
          )
        ) {
          return { ok: false, reason: 'invalid-command' }
        }
        await context.changeChampion(command.value)
        context.setTab('champion')
        break
      case 'tab':
        context.setTab(command.value)
        break
      case 'refresh':
        await context.refresh()
        break
    }
    if (context.isDataUnavailable.value) return { ok: false, reason: 'data-unavailable' }
    const updatedView = view.value
    const matched =
      command.type === 'refresh' ||
      (command.type === 'champion'
        ? updatedView.champion?.id === command.value && updatedView.tab === 'champion'
        : command.type === 'tab'
          ? updatedView.tab === command.value
          : updatedView[command.type] === command.value)
    if (!matched) return { ok: false, reason: 'data-unavailable' }
    return { ok: true }
  }

  lanMobile.onDesktopCommand(async ({ id, command }) => {
    let result: LanMobileCommandResult
    try {
      if (!store.settings.enabled) result = { ok: false, reason: 'service-stopped' }
      else {
        result = await navigate(command)
        await publish()
      }
    } catch {
      result = { ok: false, reason: 'data-unavailable' }
    }
    await lanMobile.completeCommand(id, result).catch(() => {})
  })
}
