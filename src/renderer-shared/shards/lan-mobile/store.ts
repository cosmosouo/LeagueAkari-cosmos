import { LAN_MOBILE_DEFAULT_PORT } from '@shared/lan-mobile'
import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

export const useLanMobileStore = defineStore('shard:lan-mobile-renderer', () => {
  const settings = shallowReactive({
    enabled: false,
    port: LAN_MOBILE_DEFAULT_PORT,
    allowApply: true
  })
  const state = shallowReactive<{
    running: boolean
    addresses: string[]
    clientCount: number
    desktopAvailable: boolean
    error: 'port-in-use' | 'start-failed' | null
  }>({ running: false, addresses: [], clientCount: 0, desktopAvailable: false, error: null })
  return { settings, state }
})
