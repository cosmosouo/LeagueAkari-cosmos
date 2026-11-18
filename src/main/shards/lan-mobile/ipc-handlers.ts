import {
  LAN_MOBILE_MAIN_NAMESPACE,
  type LanMobileCommandResult,
  type LanMobileView
} from '@shared/lan-mobile'
import { z } from 'zod'

import type { LanMobileMainContext } from './context'
import type { LanMobileDesktopController } from './desktop-controller'

export class LanMobileIpcHandlers {
  constructor(
    private readonly _context: LanMobileMainContext,
    private readonly _desktop: LanMobileDesktopController,
    private readonly _restart: () => Promise<void>
  ) {}

  register() {
    const { ipc, settingService } = this._context
    ipc.onCall(LAN_MOBILE_MAIN_NAMESPACE, 'setEnabled', async (_, enabled: unknown) => {
      const value = z.boolean().parse(enabled)
      if (value) await this._desktop.ensureDesktopWindow()
      return settingService.set('enabled', value)
    })
    ipc.onCall(LAN_MOBILE_MAIN_NAMESPACE, 'setPort', (_, port: unknown) =>
      settingService.set('port', z.number().int().min(1024).max(65535).parse(port))
    )
    ipc.onCall(LAN_MOBILE_MAIN_NAMESPACE, 'setAllowApply', (_, allowed: unknown) =>
      settingService.set('allowApply', z.boolean().parse(allowed))
    )
    ipc.onCall(LAN_MOBILE_MAIN_NAMESPACE, 'restart', () => this._restart())
    ipc.onCall(LAN_MOBILE_MAIN_NAMESPACE, 'publishView', (event, view: LanMobileView) =>
      this._desktop.publish(event.sender.id, view)
    )
    ipc.onCall(
      LAN_MOBILE_MAIN_NAMESPACE,
      'completeCommand',
      (event, id: string, result: LanMobileCommandResult) =>
        this._desktop.complete(event.sender.id, id, result)
    )
  }
}
