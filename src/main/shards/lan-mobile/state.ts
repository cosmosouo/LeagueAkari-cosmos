import { LAN_MOBILE_DEFAULT_PORT } from '@shared/lan-mobile'
import { makeAutoObservable, observableRef } from 'mobx'

export class LanMobileSettings {
  enabled = false
  port = LAN_MOBILE_DEFAULT_PORT
  allowApply = true

  constructor() {
    makeAutoObservable(this)
  }
}

export class LanMobileState {
  running = false
  addresses: string[] = []
  clientCount = 0
  desktopAvailable = false
  error: 'port-in-use' | 'start-failed' | null = null

  constructor() {
    makeAutoObservable(this, { addresses: observableRef })
  }
}
