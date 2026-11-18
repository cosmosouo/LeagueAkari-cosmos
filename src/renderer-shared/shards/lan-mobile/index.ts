import { Dep, IAkariShardInitDispose, Shard } from '@shared/akari-shard'
import {
  LAN_MOBILE_MAIN_NAMESPACE,
  LAN_MOBILE_RENDERER_NAMESPACE,
  type LanMobileCommandResult,
  type LanMobileDesktopCommand,
  type LanMobileView
} from '@shared/lan-mobile'

import { AkariIpcRenderer } from '../ipc'
import { PiniaMobxUtilsRenderer } from '../pinia-mobx-utils'
import { useLanMobileStore } from './store'

@Shard(LanMobileRenderer.id)
export class LanMobileRenderer implements IAkariShardInitDispose {
  static id = LAN_MOBILE_RENDERER_NAMESPACE

  constructor(
    @Dep(AkariIpcRenderer) private readonly _ipc: AkariIpcRenderer,
    @Dep(PiniaMobxUtilsRenderer) private readonly _piniaMobxUtils: PiniaMobxUtilsRenderer
  ) {}

  async onInit() {
    const store = useLanMobileStore()
    await this._piniaMobxUtils.sync(LAN_MOBILE_MAIN_NAMESPACE, 'settings', store.settings)
    await this._piniaMobxUtils.sync(LAN_MOBILE_MAIN_NAMESPACE, 'state', store.state)
  }

  setEnabled(enabled: boolean) {
    return this._ipc.call(LAN_MOBILE_MAIN_NAMESPACE, 'setEnabled', enabled)
  }

  setPort(port: number) {
    return this._ipc.call(LAN_MOBILE_MAIN_NAMESPACE, 'setPort', port)
  }

  setAllowApply(allowed: boolean) {
    return this._ipc.call(LAN_MOBILE_MAIN_NAMESPACE, 'setAllowApply', allowed)
  }

  restart() {
    return this._ipc.call(LAN_MOBILE_MAIN_NAMESPACE, 'restart')
  }

  publishView(view: LanMobileView) {
    return this._ipc.call(LAN_MOBILE_MAIN_NAMESPACE, 'publishView', view)
  }

  completeCommand(id: string, result: LanMobileCommandResult) {
    return this._ipc.call(LAN_MOBILE_MAIN_NAMESPACE, 'completeCommand', id, result)
  }

  onDesktopCommand(callback: (request: LanMobileDesktopCommand) => void) {
    return this._ipc.onEventVue(LAN_MOBILE_MAIN_NAMESPACE, 'desktop-command', callback)
  }
}
