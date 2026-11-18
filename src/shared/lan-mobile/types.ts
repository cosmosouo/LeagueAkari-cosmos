import type {
  ChampionDataMode,
  ChampionDataPosition,
  ChampionDataSourceId,
  ChampionItemBuildSlotName
} from '@shared/data-adapter/champion-data'

export const LAN_MOBILE_MAIN_NAMESPACE = 'lan-mobile-main'
export const LAN_MOBILE_RENDERER_NAMESPACE = 'lan-mobile-renderer'
export const LAN_MOBILE_DEFAULT_PORT = 23946

export interface MobileAsset {
  source: 'lcu' | 'url'
  path: string
}

export interface MobileResource {
  id: number
  name: string
  icon: MobileAsset | null
  description?: string
}

export interface MobileChampion extends MobileResource {
  rank: number | null
  tier: string | number | null
  position: ChampionDataPosition
  searchKeywords: string[]
}

export interface MobileAugment extends MobileResource {
  rank: number
  rarity: string | null
}

export interface MobileRunePage {
  rank: number
  primaryStyleId: number | null
  secondaryStyleId: number | null
  primaryRuneIds: number[]
  secondaryRuneIds: number[]
  statShardIds: number[]
  perks: MobileResource[]
}

export interface MobileSpellRecommendation {
  rank: number
  spells: MobileResource[]
}

export interface MobileItemGroup {
  slot: ChampionItemBuildSlotName
  options: Array<{ rank: number; items: MobileResource[] }>
}

export interface MobileChampionDetails extends MobileChampion {
  winRate: number | null
  pickRate: number | null
  banRate: number | null
  runes: MobileRunePage[]
  summonerSpells: MobileSpellRecommendation[]
  items: MobileItemGroup[]
  augments: MobileAugment[]
  abilities: Array<{ rank: number; priority: string[]; order: string[] }>
}

export interface MobileSelectOption {
  label: string
  value: string
  disabled?: boolean
}

/** Only champion data is shared. Client credentials and player data never enter this payload. */
export interface LanMobileView {
  locale: string
  tab: 'champions' | 'champion'
  championId: number | null
  source: ChampionDataSourceId
  effectiveSource: ChampionDataSourceId | null
  mode: ChampionDataMode
  position: ChampionDataPosition
  region: string
  tier: string
  patch: string | null
  flashPosition: 'auto' | 'd' | 'f'
  loading: boolean
  unavailable: boolean
  filters: {
    sources: MobileSelectOption[]
    modes: MobileSelectOption[]
    positions: MobileSelectOption[]
    regions: MobileSelectOption[]
    tiers: MobileSelectOption[]
    patches: MobileSelectOption[]
  }
  champions: MobileChampion[]
  champion: MobileChampionDetails | null
  augments: MobileAugment[]
}

export type LanMobileErrorReason =
  | 'unauthorized'
  | 'invalid-command'
  | 'desktop-unavailable'
  | 'data-unavailable'
  | 'busy'
  | 'timeout'
  | 'apply-disabled'
  | 'client-disconnected'
  | 'not-in-champ-select'
  | 'champion-mismatch'
  | 'mode-mismatch'
  | 'stale-view'
  | 'no-recommendation'
  | 'no-editable-rune-page'
  | 'client-write-failed'
  | 'partially-applied'
  | 'service-stopped'

export type LanMobileCommandResult =
  | { ok: true; applied?: Array<'runes' | 'spells'> }
  | { ok: false; reason: LanMobileErrorReason; applied?: Array<'runes' | 'spells'> }

export interface LanMobileSnapshot {
  revision: number
  view: LanMobileView | null
  connected: boolean
  gameflowPhase: string | null
  allowApply: boolean
  canApply: boolean
  applyUnavailableReason: LanMobileErrorReason | null
}

export type LanMobileNavigationCommand =
  | { type: 'source'; value: ChampionDataSourceId }
  | { type: 'mode'; value: ChampionDataMode }
  | { type: 'position'; value: ChampionDataPosition }
  | { type: 'region' | 'tier' | 'patch'; value: string }
  | { type: 'champion'; value: number }
  | { type: 'tab'; value: 'champions' | 'champion' }
  | { type: 'refresh' }

export interface LanMobileApplyCommand {
  type: 'apply'
  target: 'runes' | 'spells' | 'all'
  index: number
  championId: number
  revision: number
}

export type LanMobileCommand = LanMobileNavigationCommand | LanMobileApplyCommand

export interface LanMobileDesktopCommand {
  id: string
  command: LanMobileNavigationCommand
}
