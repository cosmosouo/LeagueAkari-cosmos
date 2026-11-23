import { OpggHttpApiAxiosHelper } from '@shared/http-api-axios-helper/opgg'
import { Qq101HttpApiAxiosHelper } from '@shared/http-api-axios-helper/qq101'
import { type MobileResourceResolver, mobileChampionDetailsFromData } from '@shared/lan-mobile'
import { type OpggChampionBuildResponse, OpggSkillKey } from '@shared/types/opgg'
import axios, { type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { toOpggChampionDetailsViewModel } from '../../../renderer/src-opgg-window/opgg/champion-data-view-model'
import type { AkariLogger } from '../logger-factory'
import { ChampionDataMainSourceLoader } from './source-loader'

const buildPick = (ids: number[]) => ({ ids, play: 100, win: 60, pick_rate: 0.8 })
const aramBuild: OpggChampionBuildResponse = {
  data: {
    summary: {
      id: 12,
      is_rotation: false,
      is_rip: false,
      average_stats: {
        play: 1000,
        win_rate: 0.51,
        ban_rate: null,
        tier_data: { tier: 4, rank: 120, rank_prev: 121, rank_prev_patch: null }
      },
      positions: null,
      roles: []
    },
    summoner_spells: [buildPick([4, 32])],
    starter_items: [buildPick([2051, 1004])],
    boots: [buildPick([3111])],
    core_items: [buildPick([3084, 2502, 3083])],
    last_items: [buildPick([3075])],
    runes: [
      {
        id: 1,
        primary_page_id: 8400,
        secondary_page_id: 8100,
        primary_rune_ids: [8439, 8446, 8429, 8451],
        secondary_rune_ids: [8126, 8106],
        stat_mod_ids: [5007, 5008, 5002],
        play: 100,
        win: 60,
        pick_rate: 0.8
      }
    ],
    skill_masteries: [
      {
        ...buildPick([]),
        ids: [OpggSkillKey.Q, OpggSkillKey.W, OpggSkillKey.E],
        builds: [
          {
            ...buildPick([]),
            order: [
              OpggSkillKey.Q,
              OpggSkillKey.W,
              OpggSkillKey.E,
              OpggSkillKey.Q,
              OpggSkillKey.Q,
              OpggSkillKey.R
            ]
          }
        ]
      }
    ],
    skills: [],
    skill_evolves: []
  },
  meta: { version: '16.23', cached_at: new Date('2026-11-23T04:00:00Z') }
}
const mayhemAugments = { data: [{ id: 1353, tier: 0, performance: 94.69, popular: 3.67 }] }
const resources: MobileResourceResolver = {
  champion: (id) => ({ name: `Champion ${id}` }),
  item: (id) => ({ name: `Item ${id}` }),
  perk: (id) => ({ name: `Perk ${id}` }),
  spell: (id) => ({ name: `Spell ${id}` }),
  augment: (id) => ({ name: `Augment ${id}` })
}

function setup(
  options: {
    buildFailure?: Error
    augmentFailure?: Error
    missingMayhemChampion?: boolean
    onBuildRequest?: () => void
  } = {}
) {
  const requests: InternalAxiosRequestConfig[] = []
  const http = axios.create({
    adapter: async (config) => {
      requests.push(config)
      let data: unknown
      switch (config.url) {
        case '/api/contents/tiers':
          data = {
            data: options.missingMayhemChampion
              ? []
              : [{ champion_id: 12, id: 12, rank: 8, tier: 2 }]
          }
          break
        case '/api/contents/stats/champions/12/aram-augments':
          if (options.augmentFailure) throw options.augmentFailure
          data = mayhemAugments
          break
        case '/api/global/champions/aram/12/none':
          options.onBuildRequest?.()
          if (options.buildFailure) throw options.buildFailure
          data = aramBuild
          break
        default:
          throw new Error(`Unexpected OP.GG endpoint: ${config.url}`)
      }
      return { data, status: 200, statusText: 'OK', headers: {}, config }
    }
  })
  const logger = { warn: vi.fn() } as unknown as AkariLogger
  const loader = new ChampionDataMainSourceLoader(
    logger,
    new OpggHttpApiAxiosHelper(http),
    new Qq101HttpApiAxiosHelper(axios.create())
  )
  return { loader, requests }
}

describe('OP.GG Mayhem base recommendations', () => {
  it('restores desktop and phone builds while retaining the Mayhem champion rank and augments', async () => {
    const { loader, requests } = setup()
    const signal = new AbortController().signal
    const details = await loader.loadDetails(
      'opgg',
      { mode: 'aram_mayhem', region: 'kr', tier: 'challenger', patch: '16.22' },
      12,
      { signal }
    )

    expect(details).toMatchObject({
      metadata: { source: 'opgg', mode: 'aram_mayhem', patch: null },
      championId: 12,
      summary: { performance: { rank: 8, strengthTier: 2, winRate: null } },
      buildReference: { source: 'opgg', mode: 'aram', patch: '16.23' },
      sections: { augments: [{ augmentId: 1353, tier: 0, performanceScore: 94.69 }] }
    })
    const desktop = toOpggChampionDetailsViewModel(details!)
    expect(desktop.data.summoner_spells?.[0].ids).toEqual([4, 32])
    expect(desktop.data.runes?.[0].primary_rune_ids).toEqual([8439, 8446, 8429, 8451])
    expect(desktop.data.skill_masteries[0].ids).toEqual(['Q', 'W', 'E'])
    expect(desktop.data.skill_masteries[0].builds[0].order).toEqual(['Q', 'W', 'E', 'Q', 'Q', 'R'])
    expect(desktop.data.starter_items[0].ids).toEqual([2051, 1004])
    expect(desktop.data.boots[0].ids).toEqual([3111])
    expect(desktop.data.core_items[0].ids).toEqual([3084, 2502, 3083])
    expect(desktop.data.last_items[0].ids).toEqual([3075])

    const phone = mobileChampionDetailsFromData(details!, resources)
    expect(phone).toMatchObject({
      id: 12,
      rank: 8,
      buildReference: { source: 'opgg', mode: 'aram', patch: '16.23' },
      runes: [{ rank: 1, primaryRuneIds: [8439, 8446, 8429, 8451] }],
      summonerSpells: [{ rank: 1, spells: [{ id: 4 }, { id: 32 }] }],
      abilities: [{ priority: ['Q', 'W', 'E'], order: ['Q', 'W', 'E', 'Q', 'Q', 'R'] }],
      augments: [{ id: 1353, rank: 1 }]
    })
    expect(
      phone.items.map((group) => [group.slot, group.options[0].items.map((item) => item.id)])
    ).toEqual([
      ['starting', [2051, 1004]],
      ['boots', [3111]],
      ['core', [3084, 2502, 3083]],
      ['last', [3075]]
    ])
    expect(requests).toHaveLength(3)
    expect(requests.find((request) => request.url?.includes('/aram/'))).toMatchObject({
      params: { tier: 'all', version: undefined },
      signal
    })
  })

  it('keeps Mayhem ranks and augments available when the ARAM build request fails', async () => {
    const { loader } = setup({ buildFailure: new Error('ARAM is temporarily unavailable') })
    const details = await loader.loadDetails('opgg', { mode: 'aram_mayhem' }, 12)
    expect(details?.summary.performance.rank).toBe(8)
    expect(details?.sections.augments).toHaveLength(1)
    expect(details?.buildReference).toBeUndefined()
    expect(details?.sections.itemBuilds).toBeUndefined()
    expect(mobileChampionDetailsFromData(details!, resources).augments).toHaveLength(1)
  })

  it('does not substitute an ARAM champion when Mayhem has no data for that champion', async () => {
    const { loader } = setup({ missingMayhemChampion: true })
    expect(await loader.loadDetails('opgg', { mode: 'aram_mayhem' }, 12)).toBeNull()
  })

  it('propagates Mayhem errors instead of presenting an ARAM-only response as Mayhem', async () => {
    const failure = new Error('Mayhem augments are unavailable')
    const { loader } = setup({ augmentFailure: failure })
    await expect(loader.loadDetails('opgg', { mode: 'aram_mayhem' }, 12)).rejects.toBe(failure)
  })

  it('propagates cancellation instead of treating an aborted build as a partial success', async () => {
    const controller = new AbortController()
    const { loader } = setup({ onBuildRequest: () => controller.abort() })
    await expect(
      loader.loadDetails('opgg', { mode: 'aram_mayhem' }, 12, { signal: controller.signal })
    ).rejects.toBe(controller.signal.reason)
  })
})
