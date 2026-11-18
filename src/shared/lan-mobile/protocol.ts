import type { ChampionDataMode } from '@shared/data-adapter/champion-data'
import { z } from 'zod'

import type { LanMobileCommand, MobileAsset } from './types'

const modeSchema = z.enum([
  'ranked',
  'classic',
  'aram',
  'aram_mayhem',
  'arena',
  'nexus_blitz',
  'urf'
])
const positionSchema = z.enum(['all', 'none', 'top', 'jungle', 'middle', 'bottom', 'utility'])
const shortStringSchema = z.string().min(1).max(64)

export const lanMobileCommandSchema: z.ZodType<LanMobileCommand> = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('source'), value: z.enum(['opgg', 'qq101']) }),
  z.strictObject({ type: z.literal('mode'), value: modeSchema }),
  z.strictObject({ type: z.literal('position'), value: positionSchema }),
  z.strictObject({ type: z.literal('region'), value: shortStringSchema }),
  z.strictObject({ type: z.literal('tier'), value: shortStringSchema }),
  z.strictObject({ type: z.literal('patch'), value: shortStringSchema }),
  z.strictObject({ type: z.literal('champion'), value: z.number().int().positive().max(100_000) }),
  z.strictObject({ type: z.literal('tab'), value: z.enum(['champions', 'champion']) }),
  z.strictObject({ type: z.literal('refresh') }),
  z.strictObject({
    type: z.literal('apply'),
    target: z.enum(['runes', 'spells', 'all']),
    index: z.number().int().min(0).max(500),
    championId: z.number().int().positive(),
    revision: z.number().int().nonnegative()
  })
])

export function championDataModeForGameMode(gameMode: string): ChampionDataMode | null {
  switch (gameMode) {
    case 'CLASSIC':
      return 'ranked'
    case 'ARAM':
      return 'aram'
    case 'KIWI':
      return 'aram_mayhem'
    case 'CHERRY':
      return 'arena'
    case 'NEXUSBLITZ':
      return 'nexus_blitz'
    case 'URF':
    case 'ARURF':
      return 'urf'
    default:
      return null
  }
}

/** LCU assets are images only; this route must never become a general-purpose LCU proxy. */
export function isAllowedMobileAssetPath(path: string) {
  return (
    path.startsWith('/lol-game-data/assets/') &&
    !/[\\\x00-\x1f?#%]/.test(path) &&
    !path.split('/').some((segment) => segment === '.' || segment === '..') &&
    /\.(?:png|jpg|jpeg|webp|gif)$/i.test(path)
  )
}

export function mobileAssetFromPath(path: string | null | undefined): MobileAsset | null {
  if (!path) return null
  if (path.startsWith('https://')) {
    try {
      const url = new URL(path)
      return url.username || url.password ? null : { source: 'url', path }
    } catch {
      return null
    }
  }
  const normalized = path.startsWith('akari://league-client/')
    ? path.slice('akari://league-client'.length)
    : path.startsWith('/')
      ? path
      : `/${path}`
  return isAllowedMobileAssetPath(normalized) ? { source: 'lcu', path: normalized } : null
}

export function isPrivateNetworkAddress(address: string) {
  const normalized = address.replace(/^::ffff:/, '')
  if (normalized === '::1') return true
  const octets = normalized.split('.').map(Number)
  if (
    octets.length !== 4 ||
    octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return false
  }
  const [first, second] = octets
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    (first === 100 && second >= 64 && second <= 127)
  )
}
