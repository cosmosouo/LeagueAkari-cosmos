import {
  LAN_MOBILE_MAIN_NAMESPACE,
  type LanMobileCommandResult,
  type LanMobileErrorReason,
  type LanMobileNavigationCommand,
  type LanMobileSnapshot,
  type LanMobileView,
  championDataModeForGameMode
} from '@shared/lan-mobile'
import { runInAction } from 'mobx'
import { randomUUID } from 'node:crypto'

import type { LanMobileMainContext } from './context'

export class LanMobileDesktopController {
  private _view: LanMobileView | null = null
  private _revision = 0
  private _rendererId: number | null = null
  private readonly _pending = new Map<
    string,
    { resolve: (result: LanMobileCommandResult) => void; timer: ReturnType<typeof setTimeout> }
  >()

  constructor(
    private readonly _context: LanMobileMainContext,
    private readonly _onChange: (snapshot: LanMobileSnapshot) => void
  ) {}

  get view() {
    return this._view
  }

  get revision() {
    return this._revision
  }

  getApplyUnavailableReason(): LanMobileErrorReason | null {
    const { settings, leagueClient } = this._context
    if (!settings.enabled) return 'service-stopped'
    if (!settings.allowApply) return 'apply-disabled'
    if (!leagueClient.state.isConnected) return 'client-disconnected'
    const session = leagueClient.data.champSelect.session
    if (leagueClient.data.gameflow.phase !== 'ChampSelect' || !session || session.isSpectating) {
      return 'not-in-champ-select'
    }
    if (!this._view || !this._view.champion || this._view.loading) return 'data-unavailable'
    if (this._view.unavailable) return 'data-unavailable'
    const selectedChampion = leagueClient.data.champSelect.currentChampion
    if (selectedChampion !== this._view.champion.id || this._view.championId !== selectedChampion) {
      return 'champion-mismatch'
    }
    const gameMode = leagueClient.data.gameflow.session?.gameData.queue.gameMode ?? ''
    const mode = championDataModeForGameMode(gameMode)
    if (mode !== this._view.mode && !(mode === 'ranked' && this._view.mode === 'classic')) {
      return 'mode-mismatch'
    }
    return null
  }

  snapshot(): LanMobileSnapshot {
    const applyUnavailableReason = this.getApplyUnavailableReason()
    return {
      revision: this._revision,
      view: this._view,
      connected: this._context.leagueClient.state.isConnected,
      gameflowPhase: this._context.leagueClient.data.gameflow.phase,
      allowApply: this._context.settings.allowApply,
      canApply: applyUnavailableReason === null,
      applyUnavailableReason
    }
  }

  start() {
    this._context.mobxUtils.reaction(
      () => [
        this._context.leagueClient.state.isConnected,
        this._context.leagueClient.data.gameflow.phase,
        this._context.leagueClient.data.champSelect.currentChampion,
        this._context.leagueClient.data.champSelect.session?.isSpectating,
        this._context.leagueClient.data.gameflow.session?.gameData.queue.gameMode,
        this._context.settings.allowApply
      ],
      () => this.notify()
    )
  }

  async ensureDesktopWindow() {
    if (!this._context.windowManager.opggWindow.settings.enabled) {
      await this._context.settingFactory.setSetting(
        'window-manager-main/opgg-window',
        'enabled',
        true
      )
    }
  }

  publish(rendererId: number, view: LanMobileView) {
    const window = this._context.windowManager.opggWindow.window
    if (!window || window.webContents.id !== rendererId) return false
    if (this._rendererId !== rendererId) {
      this.clear()
      this._rendererId = rendererId
      window.webContents.once('destroyed', () => {
        if (this._rendererId === rendererId) this.clear()
      })
    }
    if (!this._context.settings.enabled) return false
    window.webContents.setBackgroundThrottling(false)
    this._view = view
    this._revision++
    runInAction(() => (this._context.state.desktopAvailable = true))
    this.notify()
    return true
  }

  complete(rendererId: number, id: string, result: LanMobileCommandResult) {
    if (rendererId !== this._rendererId) return false
    const pending = this._pending.get(id)
    if (!pending) return false
    clearTimeout(pending.timer)
    this._pending.delete(id)
    pending.resolve(result)
    return true
  }

  execute(command: LanMobileNavigationCommand): Promise<LanMobileCommandResult> {
    if (!this._context.settings.enabled)
      return Promise.resolve({ ok: false, reason: 'service-stopped' })
    if (!this._view || this._rendererId === null) {
      return Promise.resolve({ ok: false, reason: 'desktop-unavailable' })
    }
    const window = this._context.windowManager.opggWindow.window
    if (!window || window.webContents.isDestroyed() || window.webContents.id !== this._rendererId) {
      return Promise.resolve({ ok: false, reason: 'desktop-unavailable' })
    }
    const id = randomUUID()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._pending.delete(id)
        resolve({ ok: false, reason: 'timeout' })
      }, 30_000)
      this._pending.set(id, { resolve, timer })
      this._context.ipc.sendEventToWebContents(
        this._rendererId!,
        LAN_MOBILE_MAIN_NAMESPACE,
        'desktop-command',
        {
          id,
          command
        }
      )
    })
  }

  notify() {
    this._onChange(this.snapshot())
  }

  clear() {
    for (const pending of this._pending.values()) {
      clearTimeout(pending.timer)
      pending.resolve({ ok: false, reason: 'desktop-unavailable' })
    }
    this._pending.clear()
    const window = this._context.windowManager.opggWindow.window
    if (window && !window.webContents.isDestroyed())
      window.webContents.setBackgroundThrottling(true)
    this._view = null
    this._rendererId = null
    this._revision++
    runInAction(() => (this._context.state.desktopAvailable = false))
    this.notify()
  }
}
