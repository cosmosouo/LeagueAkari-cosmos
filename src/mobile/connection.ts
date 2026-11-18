import type {
  LanMobileCommand,
  LanMobileCommandResult,
  LanMobileSnapshot
} from '@shared/lan-mobile'
import { onMounted, onScopeDispose, ref, shallowRef } from 'vue'

export function useMobileConnection() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
  const snapshot = shallowRef<LanMobileSnapshot | null>(null)
  const synchronized = ref(false)
  const busy = ref(false)
  const connectionError = ref<'unauthorized' | 'offline' | null>(token ? null : 'unauthorized')
  let events: EventSource | null = null
  let disposed = false
  let generation = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  const controllers = new Set<AbortController>()

  const acceptSnapshot = (value: LanMobileSnapshot) => {
    if (value.revision < (snapshot.value?.revision ?? -1)) return
    snapshot.value = value
    synchronized.value = true
    connectionError.value = null
  }

  const request = async (pathname: string, command?: LanMobileCommand) => {
    const controller = new AbortController()
    controllers.add(controller)
    const timeout = window.setTimeout(() => controller.abort(), command ? 35_000 : 8_000)
    try {
      const response = await fetch(pathname, {
        method: command ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(command ? { 'Content-Type': 'application/json' } : {})
        },
        ...(command ? { body: JSON.stringify(command) } : {}),
        cache: 'no-store',
        signal: controller.signal
      })
      if (response.status === 401 || response.status === 403) {
        connectionError.value = 'unauthorized'
        synchronized.value = false
        events?.close()
        return null
      }
      return response.json()
    } finally {
      window.clearTimeout(timeout)
      controllers.delete(controller)
    }
  }

  const connect = async () => {
    if (!token || disposed) return
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = null
    const currentGeneration = ++generation
    events?.close()
    synchronized.value = false
    try {
      const initial = await request('/api/state')
      if (currentGeneration !== generation || disposed || !initial) return
      acceptSnapshot(initial)
      const stream = new EventSource(`/api/events?token=${encodeURIComponent(token)}`)
      events = stream
      stream.addEventListener('state', (event) => {
        if (currentGeneration !== generation || disposed) return
        acceptSnapshot(JSON.parse((event as MessageEvent).data))
      })
      stream.onerror = () => {
        if (currentGeneration !== generation || disposed) return
        synchronized.value = false
        connectionError.value = 'offline'
        // EventSource retries automatically. A revoked key needs a new QR code.
        void request('/api/state').catch(() => {})
      }
    } catch {
      if (currentGeneration === generation && !disposed) {
        connectionError.value = 'offline'
        reconnectTimer = setTimeout(() => {
          void connect()
        }, 1_500)
      }
    }
  }

  const sendCommand = async (command: LanMobileCommand): Promise<LanMobileCommandResult> => {
    if (!synchronized.value) return { ok: false, reason: 'desktop-unavailable' }
    if (busy.value) return { ok: false, reason: 'busy' }
    busy.value = true
    try {
      return (await request('/api/command', command)) ?? { ok: false, reason: 'unauthorized' }
    } catch {
      return { ok: false, reason: 'timeout' }
    } finally {
      busy.value = false
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void connect()
  }
  onMounted(() => {
    void connect()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', connect)
  })
  onScopeDispose(() => {
    disposed = true
    generation++
    if (reconnectTimer) clearTimeout(reconnectTimer)
    events?.close()
    for (const controller of controllers) controller.abort()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('online', connect)
  })

  return { token, snapshot, synchronized, busy, connectionError, connect, sendCommand }
}
