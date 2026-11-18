import type { ChampionAugment, ChampionDataOverview } from '@shared/data-adapter/champion-data'
import { describe, expect, it } from 'vitest'

import { isAllowedMobileAssetPath, mobileAssetFromPath } from './protocol'
import {
  type MobileResourceResolver,
  mobileAugmentsFromData,
  mobileChampionsFromData
} from './view-model'

const resources: MobileResourceResolver = {
  champion: (id) => ({
    name: `Champion ${id}`,
    iconPath: `/lol-game-data/assets/v1/champion-icons/${id}.png`
  }),
  augment: (id) => ({
    name: id === 2 ? '升级：无尽之刃' : '暴击飞弹',
    iconPath: `/lol-game-data/assets/augments/${id}.png`,
    rarity: 'kGold'
  }),
  item: () => null,
  perk: () => null,
  spell: () => null
}

describe('phone champion data', () => {
  it('preserves leaderboard ranks and names without inventing a rank for missing data', () => {
    const overview = {
      sections: {
        champions: [
          { championId: 99, position: 'none', performance: { rank: 7, strengthTier: 1 } },
          { championId: 1, position: 'none', performance: { rank: null, strengthTier: null } }
        ]
      }
    } as unknown as ChampionDataOverview
    const champions = mobileChampionsFromData(overview, resources)
    expect(champions.map((champion) => [champion.id, champion.rank, champion.name])).toEqual([
      [99, 7, 'Champion 99'],
      [1, null, 'Champion 1']
    ])
  })

  it('sorts Mayhem recommendations by strength and retains complete augment names', () => {
    const augments = [
      { augmentId: 2, tier: 2, rank: null },
      { augmentId: 1, tier: 0, rank: null }
    ] as ChampionAugment[]
    const cards = mobileAugmentsFromData(augments, resources, 'aram_mayhem')
    expect(cards.map((card) => [card.rank, card.name])).toEqual([
      [1, '暴击飞弹'],
      [2, '升级：无尽之刃']
    ])
    expect(cards[0]).toEqual({
      id: 1,
      name: '暴击飞弹',
      icon: { source: 'lcu', path: '/lol-game-data/assets/augments/1.png' },
      rank: 1,
      rarity: 'kGold'
    })
  })

  it('shows only the selected position and uses that position’s champion rank', () => {
    const overview = {
      sections: {
        champions: [
          { championId: 99, position: 'middle', performance: { rank: 7, strengthTier: 2 } },
          { championId: 99, position: 'utility', performance: { rank: 3, strengthTier: 1 } },
          { championId: 1, position: 'top', performance: { rank: 1, strengthTier: 1 } }
        ]
      }
    } as unknown as ChampionDataOverview
    expect(mobileChampionsFromData(overview, resources, 'utility')).toMatchObject([
      { id: 99, position: 'utility', rank: 3 }
    ])
    expect(mobileChampionsFromData(overview, resources, 'middle')).toMatchObject([
      { id: 99, position: 'middle', rank: 7 }
    ])
    expect(mobileChampionsFromData(overview, resources, 'all')).toHaveLength(2)
  })

  it('allows client images while refusing non-image endpoints and traversal', () => {
    expect(
      mobileAssetFromPath('akari://league-client/lol-game-data/assets/perks/rune.png')
    ).toEqual({ source: 'lcu', path: '/lol-game-data/assets/perks/rune.png' })
    expect(isAllowedMobileAssetPath('/lol-game-data/assets/%2e%2e/private.png')).toBe(false)
    expect(isAllowedMobileAssetPath('/lol-game-data/assets/../private.png')).toBe(false)
    expect(isAllowedMobileAssetPath('/lol-perks/v1/pages')).toBe(false)
    expect(mobileAssetFromPath('https://user:password@example.com/icon.png')).toBeNull()
    expect(mobileAssetFromPath('https://invalid host/icon.png')).toBeNull()
  })
})
