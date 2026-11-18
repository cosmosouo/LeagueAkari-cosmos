import { IAkariShardInitDispose, Shard } from '@shared/akari-shard'
import { LAN_MOBILE_MAIN_NAMESPACE } from '@shared/lan-mobile'
import { runInAction } from 'mobx'
import path from 'node:path'
import { z } from 'zod'

import { AkariIpcMain } from '../ipc'
import { LeagueClientMain } from '../league-client'
import { LoggerFactoryMain } from '../logger-factory'
import { MobxUtilsMain } from '../mobx-utils'
import { SettingFactoryMain } from '../setting-factory'
import { WindowManagerMain } from '../window-manager'
import type { LanMobileMainContext } from './context'
import { LanMobileDesktopController } from './desktop-controller'
import { LanMobileIpcHandlers } from './ipc-handlers'
import { LanMobileLoadoutExecutor } from './loadout-executor'
import { LanMobileServerController } from './server-controller'
import { LanMobileSettings, LanMobileState } from './state'

@Shard(LanMobileMain.id)
export class LanMobileMain implements IAkariShardInitDispose {
  static id = LAN_MOBILE_MAIN_NAMESPACE

  public readonly settings = new LanMobileSettings()
  public readonly state = new LanMobileState()

  private readonly _context: LanMobileMainContext
  private readonly _desktop: LanMobileDesktopController
  private readonly _server: LanMobileServerController
  private readonly _loadout: LanMobileLoadoutExecutor
  private readonly _ipcHandlers: LanMobileIpcHandlers
  private _lifecycle: Promise<void> = Promise.resolve()
  private _disposed = false

  constructor(
    ipc: AkariIpcMain,
    leagueClient: LeagueClientMain,
    loggerFactory: LoggerFactoryMain,
    mobxUtils: MobxUtilsMain,
    settingFactory: SettingFactoryMain,
    windowManager: WindowManagerMain
  ) {
    const logger = loggerFactory.create(LanMobileMain.id)
    const settingService = settingFactory.register(
      LanMobileMain.id,
      {
        enabled: { default: this.settings.enabled, schema: z.boolean() },
        port: { default: this.settings.port, schema: z.number().int().min(1024).max(65535) },
        allowApply: { default: this.settings.allowApply, schema: z.boolean() }
      },
      this.settings
    )
    this._context = {
      ipc,
      leagueClient,
      logger,
      mobxUtils,
      settingFactory,
      settingService,
      windowManager,
      settings: this.settings,
      state: this.state
    }
    this._desktop = new LanMobileDesktopController(this._context, (snapshot) =>
      this._server?.broadcast(snapshot)
    )
    this._loadout = new LanMobileLoadoutExecutor(this._context, this._desktop)
    this._server = new LanMobileServerController({
      rendererDirectory: path.join(__dirname, '../mobile'),
      getSnapshot: () => this._desktop.snapshot(),
      execute: (command) =>
        command.type === 'apply' ? this._loadout.execute(command) : this._desktop.execute(command),
      readAsset: async (assetPath, signal) => {
        const result = await leagueClient.request({
          url: assetPath,
          method: 'GET',
          responseType: 'arraybuffer',
          timeout: 6_000,
          signal
        })
        return {
          body: Buffer.from(result.data),
          contentType: String(result.headers['content-type'] ?? '')
        }
      },
      onClientCountChange: (count) => runInAction(() => (this.state.clientCount = count))
    })
    this._ipcHandlers = new LanMobileIpcHandlers(this._context, this._desktop, () =>
      this._scheduleRestart()
    )
  }

  async onInit() {
    await this._context.settingService.applyToState()
    this._context.mobxUtils.propSync(LanMobileMain.id, 'settings', this.settings, [
      'enabled',
      'port',
      'allowApply'
    ])
    this._context.mobxUtils.propSync(LanMobileMain.id, 'state', this.state, [
      'running',
      'addresses',
      'clientCount',
      'desktopAvailable',
      'error'
    ])
    this._ipcHandlers.register()
    this._desktop.start()
    this._context.mobxUtils.reaction(
      () => [this.settings.enabled, this.settings.port],
      () => {
        void this._scheduleRestart()
      },
      { fireImmediately: true }
    )
  }

  async onDispose() {
    this._disposed = true
    this._loadout.cancel()
    this._desktop.clear()
    await this._lifecycle
    await this._server.stop()
  }

  private _scheduleRestart() {
    this._lifecycle = this._lifecycle
      .then(() => this._restart())
      .catch(() => {
        runInAction(() => {
          this.state.running = false
          this.state.addresses = []
          this.state.error = 'start-failed'
        })
      })
    return this._lifecycle
  }

  private async _restart() {
    this._loadout.cancel()
    await this._server.stop()
    runInAction(() => {
      this.state.running = false
      this.state.addresses = []
      this.state.error = null
    })
    if (this._disposed || !this.settings.enabled) {
      this._desktop.clear()
      return
    }
    await this._desktop.ensureDesktopWindow()
    try {
      const result = await this._server.start(this.settings.port)
      if (this._disposed || !this.settings.enabled) {
        await this._server.stop()
        return
      }
      runInAction(() => {
        this.state.running = true
        this.state.addresses = result.addresses
      })
      this._context.logger.info(`LAN mobile service listening on port ${result.port}`)
    } catch (error) {
      const reason =
        (error as NodeJS.ErrnoException).code === 'EADDRINUSE' ? 'port-in-use' : 'start-failed'
      runInAction(() => {
        this.state.error = reason
      })
      this._context.logger.warn(`LAN mobile service could not start: ${reason}`)
    }
  }
}
