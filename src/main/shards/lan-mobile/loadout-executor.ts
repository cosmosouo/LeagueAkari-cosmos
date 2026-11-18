import {
  LAN_MOBILE_MAIN_NAMESPACE,
  type LanMobileApplyCommand,
  type LanMobileCommandResult,
  type LanMobileErrorReason,
  type MobileRunePage
} from '@shared/lan-mobile'

import type { LanMobileMainContext } from './context'
import type { LanMobileDesktopController } from './desktop-controller'

class MobileApplyError extends Error {
  constructor(readonly reason: LanMobileErrorReason) {
    super(reason)
  }
}

export class LanMobileLoadoutExecutor {
  private _controller: AbortController | null = null

  constructor(
    private readonly _context: LanMobileMainContext,
    private readonly _desktop: LanMobileDesktopController
  ) {}

  cancel() {
    this._controller?.abort()
  }

  async execute(command: LanMobileApplyCommand): Promise<LanMobileCommandResult> {
    if (this._controller) return { ok: false, reason: 'busy' }
    const controller = new AbortController()
    this._controller = controller
    const applied: Array<'runes' | 'spells'> = []
    try {
      this._assertCurrent(command)
      const champion = this._desktop.view!.champion!
      const runes = command.target !== 'spells' ? champion.runes[command.index] : undefined
      const spells = command.target !== 'runes' ? champion.summonerSpells[command.index] : undefined
      if (
        (command.target === 'runes' && !runes) ||
        (command.target === 'spells' && !spells) ||
        (!runes && !spells)
      ) {
        throw new MobileApplyError('no-recommendation')
      }
      if (runes) {
        await this._applyRunes(command, runes, controller.signal)
        applied.push('runes')
      }
      if (spells) {
        await this._applySpells(
          command,
          spells.spells.map((spell) => spell.id),
          controller.signal
        )
        applied.push('spells')
      }
      this._context.ipc.sendEvent(LAN_MOBILE_MAIN_NAMESPACE, 'loadout-applied', applied)
      return { ok: true, applied }
    } catch (error) {
      const reason = error instanceof MobileApplyError ? error.reason : 'client-write-failed'
      // Only report the reason, never an Axios request containing client credentials.
      this._context.logger.warn(`Mobile loadout application failed: ${reason}`)
      return { ok: false, reason: applied.length ? 'partially-applied' : reason, applied }
    } finally {
      this._controller = null
    }
  }

  private _assertCurrent(command: LanMobileApplyCommand) {
    if (this._controller?.signal.aborted) throw new MobileApplyError('service-stopped')
    const reason = this._desktop.getApplyUnavailableReason()
    if (reason) throw new MobileApplyError(reason)
    if (this._desktop.revision !== command.revision) throw new MobileApplyError('stale-view')
    if (this._desktop.view?.champion?.id !== command.championId) {
      throw new MobileApplyError('champion-mismatch')
    }
  }

  private async _applyRunes(
    command: LanMobileApplyCommand,
    runes: MobileRunePage,
    signal: AbortSignal
  ) {
    if (
      !runes.primaryStyleId ||
      !runes.secondaryStyleId ||
      runes.primaryRuneIds.length !== 4 ||
      runes.secondaryRuneIds.length !== 2 ||
      runes.statShardIds.length !== 3
    ) {
      throw new MobileApplyError('no-recommendation')
    }
    const { api } = this._context.leagueClient
    const name = `[League Akari] ${this._desktop.view!.champion!.name}`
    const inventory = (await api.perks.getPerkInventory({ signal })).data
    let pageId: number
    if (inventory.canAddCustomPage) {
      this._assertCurrent(command)
      const page = (
        await api.perks.postPerkPage(
          {
            name,
            isEditable: true,
            primaryStyleId: String(runes.primaryStyleId)
          },
          { signal }
        )
      ).data
      pageId = page.id
    } else {
      const pages = (await api.perks.getPerkPages({ signal })).data
      const editablePages = pages.filter((page) => page.isEditable && !page.isTemporary)
      const page =
        editablePages.find((page) => page.name.startsWith('[League Akari]')) ??
        editablePages.find((page) => page.current) ??
        editablePages[0]
      if (!page) throw new MobileApplyError('no-editable-rune-page')
      pageId = page.id
    }
    this._assertCurrent(command)
    await api.perks.putPage(
      {
        id: pageId,
        isRecommendationOverride: false,
        isTemporary: false,
        name,
        primaryStyleId: runes.primaryStyleId,
        subStyleId: runes.secondaryStyleId,
        selectedPerkIds: [...runes.primaryRuneIds, ...runes.secondaryRuneIds, ...runes.statShardIds]
      },
      { signal }
    )
    this._assertCurrent(command)
    await api.perks.putCurrentPage(pageId, { signal })
  }

  private async _applySpells(command: LanMobileApplyCommand, ids: number[], signal: AbortSignal) {
    if (ids.length !== 2 || ids[0] === ids[1]) throw new MobileApplyError('no-recommendation')
    const { api } = this._context.leagueClient
    const selection = (await api.champSelect.getMySelections({ signal })).data
    let [first, second] = ids
    const preference = this._desktop.view!.flashPosition
    if (ids.includes(4) && preference !== 'auto') {
      if ((preference === 'd' && second === 4) || (preference === 'f' && first === 4)) {
        ;[first, second] = [second, first]
      }
    } else if (first === selection.spell2Id || second === selection.spell1Id) {
      ;[first, second] = [second, first]
    }
    this._assertCurrent(command)
    await api.champSelect.setSummonerSpells({ spell1Id: first, spell2Id: second }, { signal })
  }
}
