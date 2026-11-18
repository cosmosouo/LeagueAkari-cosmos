import { useInstance } from '@renderer-shared/shards'
import { ChampionDataRenderer } from '@renderer-shared/shards/champion-data'
import { useChampionDataStore } from '@renderer-shared/shards/champion-data/store'
import { useLeagueClientStore } from '@renderer-shared/shards/league-client/store'
import { LoggerRenderer } from '@renderer-shared/shards/logger'
import {
  type ChampionDataOverview,
  type ChampionDataQuery,
  getChampionDataCapability
} from '@shared/data-adapter/champion-data'
import { championDataModeForGameMode } from '@shared/lan-mobile'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'

export function opggChampionRankMap(overview: ChampionDataOverview): Record<number, number> {
  const ranks: Record<number, number> = {}
  for (const champion of overview.sections.champions) {
    const rank = champion.performance.rank
    if (rank !== null && rank > 0 && !ranks[champion.championId]) ranks[champion.championId] = rank
  }
  return ranks
}

/** Fetches the current game-mode leaderboard, independently of the OP.GG window and LAN service. */
export function useOpggChampionRanks() {
  const championData = useInstance(ChampionDataRenderer)
  const championDataStore = useChampionDataStore()
  const leagueClientStore = useLeagueClientStore()
  const logger = useInstance(LoggerRenderer)
  const ranks = shallowRef<Record<number, number>>({})
  let controller: AbortController | null = null
  let generation = 0

  const mode = computed(() =>
    championDataModeForGameMode(leagueClientStore.gameflow.session?.gameData.queue.gameMode ?? '')
  )
  const query = computed<ChampionDataQuery | null>(() => {
    if (
      leagueClientStore.gameflow.phase !== 'ChampSelect' ||
      !leagueClientStore.champSelect.session?.benchEnabled ||
      !mode.value ||
      !championDataStore.availability.sources.opgg.enabled
    )
      return null
    const capability = getChampionDataCapability('opgg', mode.value)
    if (!capability) return null
    const preferences = championDataStore.settings.preferences
    return {
      source: 'opgg',
      mode: mode.value,
      ...(capability.filters.includes('region') ? { region: preferences.region } : {}),
      ...(capability.filters.includes('tier') ? { tier: preferences.tier } : {}),
      ...(capability.filters.includes('position') ? { position: preferences.position } : {})
    }
  })

  watch(
    () => JSON.stringify(query.value),
    async () => {
      const currentGeneration = ++generation
      controller?.abort()
      ranks.value = {}
      if (!query.value) return
      const currentQuery = { ...query.value }
      controller = new AbortController()
      const signal = controller.signal
      try {
        const capability = getChampionDataCapability('opgg', currentQuery.mode)!
        if (capability.filters.includes('patch')) {
          const patches = await championData.loadPatches(currentQuery, { signal })
          if (
            signal.aborted ||
            patches.status !== 'success' ||
            patches.effectiveSource !== 'opgg' ||
            !patches.data[0]
          )
            return
          currentQuery.patch = patches.data[0]
        }
        const result = await championData.loadOverview(currentQuery, { signal })
        if (
          signal.aborted ||
          currentGeneration !== generation ||
          result.status !== 'success' ||
          result.effectiveSource !== 'opgg'
        )
          return
        ranks.value = opggChampionRankMap(result.data)
      } catch {
        if (!signal.aborted)
          logger.warn('opgg-champion-ranks', 'Could not load OP.GG champion ranks')
      }
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    generation++
    controller?.abort()
  })
  return { ranks, mode }
}
