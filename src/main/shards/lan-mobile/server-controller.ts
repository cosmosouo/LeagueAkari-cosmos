import {
  type LanMobileCommand,
  type LanMobileCommandResult,
  type LanMobileSnapshot,
  isAllowedMobileAssetPath,
  isPrivateNetworkAddress,
  lanMobileCommandSchema
} from '@shared/lan-mobile'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import path from 'node:path'

export interface LanMobileServerOptions {
  rendererDirectory: string
  getSnapshot: () => LanMobileSnapshot
  execute: (command: LanMobileCommand) => Promise<LanMobileCommandResult>
  readAsset: (path: string, signal: AbortSignal) => Promise<{ body: Buffer; contentType: string }>
  onClientCountChange: (count: number) => void
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon'
}
const MAX_COMMAND_BYTES = 16 * 1024
const MAX_CLIENTS = 8

export function localMobileAddresses() {
  const addresses = new Set<string>()
  for (const values of Object.values(networkInterfaces())) {
    for (const value of values ?? []) {
      if (value.family === 'IPv4' && !value.internal && isPrivateNetworkAddress(value.address)) {
        addresses.add(value.address)
      }
    }
  }
  return [...addresses]
}

/** Owns HTTP/SSE lifecycle. No arbitrary files or client API endpoints are exposed. */
export class LanMobileServerController {
  private _server: Server | null = null
  private _token = ''
  private _port = 0
  private _commandPending = false
  private readonly _clients = new Set<ServerResponse>()
  private readonly _assetRequests = new Set<AbortController>()
  private _heartbeat: ReturnType<typeof setInterval> | null = null

  constructor(private readonly _options: LanMobileServerOptions) {}

  async start(port: number) {
    if (this._server) await this.stop()
    // The access key lasts for one server session and is never persisted or logged.
    this._token = randomBytes(24).toString('hex')
    const server = createServer((request, response) => {
      void this._handleRequest(request, response).catch(() => {
        if (!response.headersSent)
          this._json(response, 500, { ok: false, reason: 'data-unavailable' })
        else response.destroy()
      })
    })
    server.requestTimeout = 15_000
    server.headersTimeout = 10_000
    server.keepAliveTimeout = 5_000
    this._server = server
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '0.0.0.0', () => {
          server.off('error', reject)
          resolve()
        })
      })
    } catch (error) {
      this._server = null
      this._token = ''
      throw error
    }
    this._port = (server.address() as { port: number }).port
    this._heartbeat = setInterval(() => {
      for (const client of this._clients) {
        if (!client.write(': heartbeat\n\n')) client.destroy()
      }
    }, 15_000)
    this._heartbeat.unref()
    const addresses = localMobileAddresses()
    return {
      port: this._port,
      addresses: (addresses.length ? addresses : ['127.0.0.1']).map(
        (address) => `http://${address}:${this._port}/#token=${this._token}`
      )
    }
  }

  async stop() {
    if (this._heartbeat) clearInterval(this._heartbeat)
    this._heartbeat = null
    this._token = ''
    for (const controller of this._assetRequests) controller.abort()
    this._assetRequests.clear()
    for (const client of this._clients) client.end()
    this._clients.clear()
    this._options.onClientCountChange(0)
    const server = this._server
    this._server = null
    this._port = 0
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      })
    }
  }

  broadcast(snapshot: LanMobileSnapshot) {
    const event = `event: state\ndata: ${JSON.stringify(snapshot)}\n\n`
    for (const client of this._clients) {
      if (!client.write(event)) client.destroy()
    }
  }

  private _json(response: ServerResponse, status: number, value: unknown) {
    response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    response.end(JSON.stringify(value))
  }

  private _validToken(request: IncomingMessage, url: URL) {
    const bearer = request.headers.authorization?.replace(/^Bearer /, '')
    const candidate = bearer ?? url.searchParams.get('token') ?? ''
    const expectedBytes = Buffer.from(this._token)
    const candidateBytes = Buffer.from(candidate)
    return (
      expectedBytes.length > 0 &&
      candidateBytes.length === expectedBytes.length &&
      timingSafeEqual(candidateBytes, expectedBytes)
    )
  }

  private _requestOrigin(request: IncomingMessage) {
    if (!isPrivateNetworkAddress(request.socket.remoteAddress ?? '')) return null
    try {
      const url = new URL(`http://${request.headers.host}`)
      const hosts = new Set(['127.0.0.1', 'localhost', ...localMobileAddresses()])
      if (Number(url.port) !== this._port || !hosts.has(url.hostname)) return null
      return url.origin
    } catch {
      return null
    }
  }

  private async _handleRequest(request: IncomingMessage, response: ServerResponse) {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
    )
    const origin = this._requestOrigin(request)
    if (!origin) return this._json(response, 403, { ok: false, reason: 'unauthorized' })
    const url = new URL(request.url ?? '/', origin)
    if (
      url.origin !== origin ||
      (request.headers.origin && request.headers.origin !== origin) ||
      request.headers['sec-fetch-site'] === 'cross-site'
    ) {
      return this._json(response, 403, { ok: false, reason: 'unauthorized' })
    }

    if (url.pathname.startsWith('/api/')) {
      if (!this._validToken(request, url)) {
        return this._json(response, 401, { ok: false, reason: 'unauthorized' })
      }
      if (url.pathname === '/api/state' && request.method === 'GET') {
        return this._json(response, 200, this._options.getSnapshot())
      }
      if (url.pathname === '/api/events' && request.method === 'GET') {
        return this._openEvents(response)
      }
      if (url.pathname === '/api/command' && request.method === 'POST') {
        return this._executeCommand(request, response)
      }
      if (url.pathname === '/api/asset' && request.method === 'GET') {
        return this._serveAsset(url, response)
      }
      return this._json(response, 404, { ok: false, reason: 'invalid-command' })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return this._json(response, 405, { ok: false, reason: 'invalid-command' })
    }
    const relativePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    const extension = path.extname(relativePath)
    if (
      relativePath !== 'index.html' &&
      (!/^assets\/[a-zA-Z0-9_.-]+$/.test(relativePath) || !CONTENT_TYPES[extension])
    ) {
      return this._json(response, 404, { ok: false, reason: 'invalid-command' })
    }
    try {
      const body = await readFile(path.join(this._options.rendererDirectory, relativePath))
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extension],
        'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable'
      })
      response.end(request.method === 'HEAD' ? undefined : body)
    } catch {
      this._json(response, 404, { ok: false, reason: 'data-unavailable' })
    }
  }

  private _openEvents(response: ServerResponse) {
    if (this._clients.size >= MAX_CLIENTS) {
      return this._json(response, 429, { ok: false, reason: 'busy' })
    }
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive'
    })
    response.write(
      `retry: 1500\nevent: state\ndata: ${JSON.stringify(this._options.getSnapshot())}\n\n`
    )
    this._clients.add(response)
    this._options.onClientCountChange(this._clients.size)
    response.once('close', () => {
      this._clients.delete(response)
      this._options.onClientCountChange(this._clients.size)
    })
  }

  private async _executeCommand(request: IncomingMessage, response: ServerResponse) {
    if (!request.headers['content-type']?.startsWith('application/json')) {
      return this._json(response, 415, { ok: false, reason: 'invalid-command' })
    }
    if (this._commandPending) return this._json(response, 409, { ok: false, reason: 'busy' })
    this._commandPending = true
    const sessionToken = this._token
    try {
      const chunks: Buffer[] = []
      let length = 0
      for await (const chunk of request) {
        length += chunk.length
        if (length > MAX_COMMAND_BYTES) {
          return this._json(response, 413, { ok: false, reason: 'invalid-command' })
        }
        chunks.push(chunk)
      }
      const command = lanMobileCommandSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString()))
      if (!command.success)
        return this._json(response, 400, { ok: false, reason: 'invalid-command' })
      if (!sessionToken || sessionToken !== this._token) {
        return this._json(response, 409, { ok: false, reason: 'service-stopped' })
      }
      const result = await this._options.execute(command.data)
      this._json(response, 200, result)
    } catch {
      this._json(response, 400, { ok: false, reason: 'invalid-command' })
    } finally {
      this._commandPending = false
    }
  }

  private async _serveAsset(url: URL, response: ServerResponse) {
    const assetPath = url.searchParams.get('path') ?? ''
    if (!isAllowedMobileAssetPath(assetPath)) {
      return this._json(response, 400, { ok: false, reason: 'invalid-command' })
    }
    const controller = new AbortController()
    this._assetRequests.add(controller)
    response.once('close', () => controller.abort())
    try {
      const asset = await this._options.readAsset(assetPath, controller.signal)
      if (!asset.contentType.startsWith('image/') || asset.body.length > 4 * 1024 * 1024) {
        return this._json(response, 502, { ok: false, reason: 'data-unavailable' })
      }
      response.writeHead(200, {
        'Content-Type': asset.contentType,
        'Cache-Control': 'private, max-age=3600'
      })
      response.end(asset.body)
    } catch {
      if (!response.destroyed)
        this._json(response, 503, { ok: false, reason: 'client-disconnected' })
    } finally {
      this._assetRequests.delete(controller)
    }
  }
}
