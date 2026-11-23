import type {
  ChampionAugment,
  ChampionDataDetails,
  ChampionDataOverview,
  ChampionDataPosition,
  ChampionOverviewItem
} from '@shared/data-adapter/champion-data'

import { mobileAssetFromPath } from './protocol'
import type { MobileAugment, MobileChampion, MobileChampionDetails, MobileResource } from './types'

export interface MobileResourceResolver {
  champion(id: number): { name: string; iconPath?: string; searchKeywords?: readonly string[] }
  item(id: number): { name: string; iconPath?: string; description?: string } | null
  perk(id: number): { name: string; iconPath?: string; description?: string } | null
  spell(id: number): { name: string; iconPath?: string; description?: string } | null
  augment(id: number): {
    name: string
    iconPath?: string
    description?: string
    rarity?: string
  }
}

function resource(
  id: number,
  value: { name: string; iconPath?: string; description?: string } | null
): MobileResource {
  return {
    id,
    name: value?.name ?? String(id),
    icon: mobileAssetFromPath(value?.iconPath),
    ...(value?.description ? { description: value.description } : {})
  }
}

export function mobileChampionFromOverview(
  item: ChampionOverviewItem,
  resources: MobileResourceResolver
): MobileChampion {
  const value = resources.champion(item.championId)
  return {
    ...resource(item.championId, value),
    rank: item.performance.rank && item.performance.rank > 0 ? item.performance.rank : null,
    tier: item.performance.strengthTier,
    position: item.position,
    searchKeywords: [...(value.searchKeywords ?? [])]
  }
}

export function mobileAugmentsFromData(
  augments: ChampionAugment[],
  resources: MobileResourceResolver,
  mode: string
): MobileAugment[] {
  const sorted = augments.toSorted((first, second) => {
    if (first.rank !== null && second.rank !== null) return first.rank - second.rank
    // In Mayhem, tier denotes strength. In Arena it denotes rarity, not ranking.
    return mode === 'aram_mayhem' ? (first.tier ?? Infinity) - (second.tier ?? Infinity) : 0
  })
  return sorted.map((augment, index) => {
    const value = resources.augment(augment.augmentId)
    return {
      ...resource(augment.augmentId, value),
      rank: augment.rank && augment.rank > 0 ? augment.rank : index + 1,
      rarity: value.rarity ?? null
    }
  })
}

export function mobileChampionDetailsFromData(
  details: ChampionDataDetails,
  resources: MobileResourceResolver
): MobileChampionDetails {
  return {
    ...mobileChampionFromOverview(details.summary, resources),
    winRate: details.summary.performance.winRate,
    pickRate: details.summary.performance.pickRate,
    banRate: details.summary.performance.banRate,
    ...(details.buildReference ? { buildReference: { ...details.buildReference } } : {}),
    runes: (details.sections.runePages ?? []).map((page, index) => ({
      rank: page.performance.rank ?? index + 1,
      primaryStyleId: page.primaryStyleId,
      secondaryStyleId: page.secondaryStyleId,
      primaryRuneIds: [...page.primaryRuneIds],
      secondaryRuneIds: [...page.secondaryRuneIds],
      statShardIds: [...page.statShardIds],
      perks: [...page.primaryRuneIds, ...page.secondaryRuneIds, ...page.statShardIds].map((id) =>
        resource(id, resources.perk(id))
      )
    })),
    summonerSpells: (details.sections.summonerSpells ?? []).map((spells, index) => ({
      rank: spells.performance.rank ?? index + 1,
      spells: spells.spellIds.map((id) => resource(id, resources.spell(id)))
    })),
    items: (details.sections.itemBuilds ?? [])
      .filter((group) => group.options.length > 0)
      .map((group) => ({
        slot: group.slot,
        options: group.options.map((option, index) => ({
          rank: option.performance.rank ?? index + 1,
          items: option.itemIds.map((id) => resource(id, resources.item(id)))
        }))
      })),
    augments: mobileAugmentsFromData(
      details.sections.augments ?? [],
      resources,
      details.metadata.mode
    ),
    abilities: (details.sections.abilityBuilds ?? []).map((build, index) => ({
      rank: build.performance.rank ?? index + 1,
      priority: [...build.abilityPriority],
      order: [...build.levelOrder]
    }))
  }
}

export function mobileChampionsFromData(
  overview: ChampionDataOverview | null,
  resources: MobileResourceResolver,
  position: ChampionDataPosition = 'all'
): MobileChampion[] {
  const champions = new Map<number, MobileChampion>()
  for (const item of overview?.sections.champions ?? []) {
    if (position !== 'all' && position !== 'none' && item.position !== position) continue
    if (!champions.has(item.championId)) {
      champions.set(item.championId, mobileChampionFromOverview(item, resources))
    }
  }
  return [...champions.values()].toSorted(
    (first, second) => (first.rank ?? Infinity) - (second.rank ?? Infinity)
  )
}
