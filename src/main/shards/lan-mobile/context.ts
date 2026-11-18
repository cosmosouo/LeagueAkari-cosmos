import type { AkariIpcMain } from '../ipc'
import type { LeagueClientMain } from '../league-client'
import type { AkariLogger } from '../logger-factory'
import type { MobxUtilsMain } from '../mobx-utils'
import type { SettingFactoryMain } from '../setting-factory'
import type { SetterSettingService } from '../setting-factory/setter-setting-service'
import type { WindowManagerMain } from '../window-manager'
import type { LanMobileSettings, LanMobileState } from './state'

export interface LanMobileMainContext {
  ipc: AkariIpcMain
  leagueClient: LeagueClientMain
  logger: AkariLogger
  mobxUtils: MobxUtilsMain
  settingFactory: SettingFactoryMain
  settingService: SetterSettingService<LanMobileSettings>
  windowManager: WindowManagerMain
  settings: LanMobileSettings
  state: LanMobileState
}
