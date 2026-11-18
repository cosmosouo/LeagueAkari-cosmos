import type { LanMobileSnapshot } from '@shared/lan-mobile'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LanMobileServerController } from './server-controller'

const snapshot: LanMobileSnapshot = {
  revision: 1,
  view: null,
  connected: false,
  gameflowPhase: null,
  allowApply: true,
  canApply: false,
  applyUnavailableReason: 'client-disconnected'
}
const disposables: Array<() => Promise<void>> = []

async function startServer() {
  const directory = await mkdtemp(path.join(tmpdir(), 'akari-lan-test-'))
  await mkdir(path.join(directory, 'assets'))
  await writeFile(path.join(directory, 'index.html'), '<main>Champion data</main>')
  await writeFile(path.join(directory, 'assets', 'mobile.js'), 'export const mobile = true')
  const execute = vi.fn().mockResolvedValue({ ok: true })
  const readAsset = vi
    .fn()
    .mockResolvedValue({ body: Buffer.from([1, 2, 3]), contentType: 'image/png' })
  const onClientCountChange = vi.fn()
  const server = new LanMobileServerController({
    rendererDirectory: directory,
    getSnapshot: () => snapshot,
    execute,
    readAsset,
    onClientCountChange
  })
  const started = await server.start(0)
  const token = new URLSearchParams(new URL(started.addresses[0]).hash.slice(1)).get('token')!
  const origin = `http://127.0.0.1:${started.port}`
  const headers = { Authorization: `Bearer ${token}` }
  disposables.push(async () => {
    await server.stop()
    if (
      path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
      !path.basename(directory).startsWith('akari-lan-test-')
    ) {
      throw new Error('Refusing to remove a directory outside the test temporary directory')
    }
    await rm(directory, { recursive: true, force: true })
  })
  return { server, origin, token, headers, execute, readAsset, onClientCountChange }
}

afterEach(async () => {
  for (const dispose of disposables.splice(0).reverse()) await dispose()
})

describe('LAN mobile HTTP service', () => {
  it('serves the phone app and requires the session key for data and commands', async () => {
    const { origin, headers, execute } = await startServer()
    const page = await fetch(origin)
    expect(await page.text()).toContain('Champion data')
    expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect((await fetch(`${origin}/api/state`)).status).toBe(401)
    expect(await (await fetch(`${origin}/api/state`, { headers })).json()).toEqual(snapshot)
    const result = await fetch(`${origin}/api/command`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'refresh' })
    })
    expect(await result.json()).toEqual({ ok: true })
    expect(execute).toHaveBeenCalledWith({ type: 'refresh' })
  })

  it('rejects foreign origins, hostnames and arbitrary client/file requests', async () => {
    const { origin, headers, readAsset } = await startServer()
    expect(
      (
        await fetch(`${origin}/api/state`, {
          headers: { ...headers, Origin: 'https://example.com' }
        })
      ).status
    ).toBe(403)
    const foreignHostStatus = await new Promise<number>((resolve, reject) => {
      httpRequest(
        `${origin}/api/state`,
        {
          headers: { ...headers, Host: 'attacker.example:23946' }
        },
        (response) => {
          response.resume()
          resolve(response.statusCode!)
        }
      )
        .on('error', reject)
        .end()
    })
    expect(foreignHostStatus).toBe(403)
    expect((await fetch(`${origin}/assets/../../package.json`)).status).toBe(404)
    expect((await fetch(`${origin}/main-window.html`)).status).toBe(404)
    expect(
      (
        await fetch(`${origin}/api/asset?path=${encodeURIComponent('/lol-perks/v1/pages')}`, {
          headers
        })
      ).status
    ).toBe(400)
    expect(
      (
        await fetch(
          `${origin}/api/asset?path=${encodeURIComponent('/lol-game-data/assets/../private.png')}`,
          { headers }
        )
      ).status
    ).toBe(400)
    expect(readAsset).not.toHaveBeenCalled()
  })

  it('accepts only image assets and bounded, validated commands', async () => {
    const { origin, headers, readAsset, execute } = await startServer()
    const assetPath = '/lol-game-data/assets/v1/champion-icons/99.png'
    const asset = await fetch(`${origin}/api/asset?path=${encodeURIComponent(assetPath)}`, {
      headers
    })
    expect(asset.status).toBe(200)
    expect(readAsset).toHaveBeenCalledWith(assetPath, expect.any(AbortSignal))
    const invalid = await fetch(`${origin}/api/command`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'apply',
        target: 'runes',
        championId: 99,
        revision: 1,
        index: -1
      })
    })
    expect(invalid.status).toBe(400)
    const oversized = await fetch(`${origin}/api/command`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'region', value: 'x'.repeat(17_000) })
    })
    expect(oversized.status).toBe(413)
    expect(execute).not.toHaveBeenCalled()
  })

  it('streams desktop changes and revokes the previous key after restarting', async () => {
    const { server, origin, token, headers, onClientCountChange } = await startServer()
    const controller = new AbortController()
    const response = await fetch(`${origin}/api/events?token=${token}`, {
      signal: controller.signal
    })
    const reader = response.body!.getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('"revision":1')
    server.broadcast({ ...snapshot, revision: 2, connected: true })
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('"revision":2')
    expect(onClientCountChange).toHaveBeenCalledWith(1)
    controller.abort()
    await reader.cancel().catch(() => {})
    await server.stop()
    const restarted = await server.start(Number(new URL(origin).port))
    expect(new URL(restarted.addresses[0]).hash).not.toContain(token)
    expect((await fetch(`${origin}/api/state`, { headers })).status).toBe(401)
  })
})
