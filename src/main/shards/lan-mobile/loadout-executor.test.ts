import type { LanMobileApplyCommand, LanMobileErrorReason, LanMobileView } from '@shared/lan-mobile'
import { describe, expect, it, vi } from 'vitest'

import type { LanMobileMainContext } from './context'
import type { LanMobileDesktopController } from './desktop-controller'
import { LanMobileLoadoutExecutor } from './loadout-executor'

function setup() {
  const runes = {
    primaryStyleId: 8000,
    secondaryStyleId: 8100,
    primaryRuneIds: [8005, 9111, 9104, 8014],
    secondaryRuneIds: [8139, 8135],
    statShardIds: [5005, 5008, 5002]
  }
  const view = {
    championId: 99,
    champion: {
      id: 99,
      name: 'Lux',
      runes: [runes],
      summonerSpells: [{ spells: [{ id: 4 }, { id: 14 }] }]
    },
    flashPosition: 'f'
  } as unknown as LanMobileView
  const api = {
    perks: {
      getPerkInventory: vi.fn().mockResolvedValue({ data: { canAddCustomPage: false } }),
      getPerkPages: vi.fn().mockResolvedValue({
        data: [
          { id: 1, isEditable: false, current: true, name: 'Preset' },
          { id: 7, isEditable: true, isTemporary: false, current: false, name: 'My page' }
        ]
      }),
      postPerkPage: vi.fn().mockResolvedValue({ data: { id: 8 } }),
      putPage: vi.fn().mockResolvedValue({}),
      putCurrentPage: vi.fn().mockResolvedValue({})
    },
    champSelect: {
      getMySelections: vi.fn().mockResolvedValue({ data: { spell1Id: 14, spell2Id: 4 } }),
      setSummonerSpells: vi.fn().mockResolvedValue({})
    }
  }
  const context = {
    leagueClient: { api },
    ipc: { sendEvent: vi.fn() },
    logger: { warn: vi.fn() }
  } as unknown as LanMobileMainContext
  let unavailableReason: LanMobileErrorReason | null = null
  const desktop = {
    view,
    revision: 5,
    getApplyUnavailableReason: () => unavailableReason
  } as LanMobileDesktopController
  const executor = new LanMobileLoadoutExecutor(context, desktop)
  const command: LanMobileApplyCommand = {
    type: 'apply',
    target: 'all',
    index: 0,
    championId: 99,
    revision: 5
  }
  return {
    api,
    context,
    desktop,
    executor,
    command,
    setUnavailableReason: (reason: LanMobileErrorReason) => {
      unavailableReason = reason
    }
  }
}

describe('mobile recommendation application', () => {
  it('uses an editable rune page and keeps Flash on the preferred key', async () => {
    const { api, executor, command } = setup()
    expect(await executor.execute(command)).toEqual({ ok: true, applied: ['runes', 'spells'] })
    expect(api.perks.putPage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        selectedPerkIds: [8005, 9111, 9104, 8014, 8139, 8135, 5005, 5008, 5002]
      }),
      expect.anything()
    )
    expect(api.perks.putCurrentPage).toHaveBeenCalledWith(7, expect.anything())
    expect(api.champSelect.setSummonerSpells).toHaveBeenCalledWith(
      { spell1Id: 14, spell2Id: 4 },
      expect.anything()
    )
  })

  it('refuses disabled or stale phone requests before making any client changes', async () => {
    const { executor, api, command, setUnavailableReason } = setup()
    expect(await executor.execute({ ...command, revision: 4 })).toMatchObject({
      ok: false,
      reason: 'stale-view'
    })
    setUnavailableReason('apply-disabled')
    expect(await executor.execute(command)).toMatchObject({ ok: false, reason: 'apply-disabled' })
    expect(api.perks.getPerkInventory).not.toHaveBeenCalled()
    expect(api.champSelect.setSummonerSpells).not.toHaveBeenCalled()
  })

  it('stops when the selected champion changes while loading the rune inventory', async () => {
    const { executor, api, command, setUnavailableReason } = setup()
    api.perks.getPerkInventory.mockImplementation(async () => {
      setUnavailableReason('champion-mismatch')
      return { data: { canAddCustomPage: true } }
    })
    expect(await executor.execute({ ...command, target: 'runes' })).toMatchObject({
      ok: false,
      reason: 'champion-mismatch'
    })
    expect(api.perks.postPerkPage).not.toHaveBeenCalled()
    expect(api.perks.putPage).not.toHaveBeenCalled()
  })

  it('does not overwrite system rune pages when no editable page is available', async () => {
    const { executor, api, command } = setup()
    api.perks.getPerkPages.mockResolvedValue({
      data: [{ id: 1, isEditable: false, current: true, name: 'Preset' }]
    })
    expect(await executor.execute({ ...command, target: 'runes' })).toMatchObject({
      ok: false,
      reason: 'no-editable-rune-page'
    })
    expect(api.perks.putPage).not.toHaveBeenCalled()
  })

  it('reports partial application if spells fail after the rune page was applied', async () => {
    const { executor, api, command, context } = setup()
    api.champSelect.setSummonerSpells.mockRejectedValue(new Error('client closed'))
    expect(await executor.execute(command)).toEqual({
      ok: false,
      reason: 'partially-applied',
      applied: ['runes']
    })
    expect(context.ipc.sendEvent).not.toHaveBeenCalled()
  })

  it('cancels an in-flight application when the service is stopped', async () => {
    const { executor, api, command } = setup()
    api.perks.getPerkInventory.mockImplementation(async () => {
      executor.cancel()
      return { data: { canAddCustomPage: true } }
    })
    expect(await executor.execute(command)).toMatchObject({ ok: false, reason: 'service-stopped' })
    expect(api.perks.postPerkPage).not.toHaveBeenCalled()
  })
})
