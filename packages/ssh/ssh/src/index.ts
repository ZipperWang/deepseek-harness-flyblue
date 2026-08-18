/** SSH host storage and non-replaying command execution. */
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Client } from 'ssh2'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { type SshHost, SshHostId, type SshHostSummary } from './types.ts'

export { SshHostId } from './types.ts'
export type { SshHost, SshHostSummary } from './types.ts'
/** Configures SSH connection and output bounds. */
export interface Config {
  /** Maximum time in milliseconds to establish an SSH connection. */
  connectTimeoutMs?: number
  /** Maximum time in milliseconds for one dispatched command. */
  execTimeoutMs?: number
  /** Maximum captured bytes for each standard output stream. */
  outputLimitBytes?: number
  /** Reserved idle connection lifetime in milliseconds. */
  idleTimeoutMs?: number
}
/** Runtime schema for SSH limits. */
export const Config: z<Config> = z.object({
  connectTimeoutMs: z.natural().min(1).default(15_000),
  execTimeoutMs: z.natural().min(1).default(60_000),
  outputLimitBytes: z.natural().min(1).default(2_097_152),
  idleTimeoutMs: z.natural().min(1).default(1_800_000),
})
interface Store { version: 1; hosts: SshHost[] }
declare module '@deepseek-ai/cordis' { interface Context { ssh: SshService } }

/**
 * Host SSH service. A connection loss after channel dispatch reports an unknown result and is never replayed.
 * @typert service ssh
 */
export class SshService extends TypertRemoteService {
  private readonly path = dshHomePath('dsh-ssh.json')
  private store: Store = { version: 1, hosts: [] }
  /** @param ctx - Host context. @param config - validated connection limits. */
  constructor(ctx: Context, private readonly config: Config = {}) { super(ctx, 'ssh'); void this.load() }
  /**
   * List configured hosts without passwords, passphrases, or key paths.
   * @returns Secret-free copies of the configured host records.
   */
  @Remote({ authority: 'loopback' })
  list(): SshHostSummary[] { return this.store.hosts.map(({ password: _password, privateKeyPath: _privateKeyPath, ...host }) => ({ ...host, auth: _password === undefined ? 'key' : 'password' })) }
  /**
   * Save a host record. The complete secret-bearing configuration remains local.
   * @param host - Complete local host configuration to insert or replace.
   * @returns The saved host with secret fields removed.
   */
  @Remote({ authority: 'loopback' })
  async put(host: SshHost): Promise<SshHostSummary> {
    if (host.alias.trim() === '' || host.host.trim() === '' || host.user.trim() === '' || host.port < 1 || host.port > 65535) throw new Error('ssh: invalid host configuration')
    const index = this.store.hosts.findIndex(item => item.id === host.id)
    if (index < 0) this.store.hosts.push(host)
    else this.store.hosts[index] = host
    await this.persist()
    return this.list().find(item => item.id === host.id) as SshHostSummary
  }
  /**
   * Remove a host record.
   * @param id - Stable identifier of the host to remove.
   */
  @Remote({ authority: 'loopback' })
  async remove(id: SshHostId): Promise<void> { this.store.hosts = this.store.hosts.filter(host => host.id !== id); await this.persist() }
  /**
   * Execute one command once. A dropped dispatched channel returns `result-unknown`.
   * @param id - Stable identifier of the configured host.
   * @param command - Command text passed to the remote SSH server.
   * @returns Captured streams, exit status, and whether the dispatched result is known.
   */
  @Remote({ authority: 'loopback' })
  async exec(id: SshHostId, command: string): Promise<{ stdout: string; stderr: string; exitCode: number | null; result: 'known' | 'result-unknown' }> {
    const host = this.store.hosts.find(item => item.id === id)
    if (host === undefined) throw new Error('ssh: unknown host')
    return new Promise((resolveResult, reject) => {
      const client = new Client()
      let dispatched = false
      const fail = (error: Error): void => {
        client.end()
        if (dispatched) resolveResult({ stdout: '', stderr: '', exitCode: null, result: 'result-unknown' })
        else reject(error)
      }
      client.once('error', fail)
      client.once('ready', () => {
        client.exec(command, (error, stream) => {
          if (error !== undefined) { fail(error); return }
          dispatched = true
          let stdout = ''; let stderr = ''
          const cap = this.config.outputLimitBytes ?? 2_097_152
          stream.on('data', (chunk: Buffer) => { if (Buffer.byteLength(stdout) < cap) stdout += chunk.toString('utf8') })
          stream.stderr.on('data', (chunk: Buffer) => { if (Buffer.byteLength(stderr) < cap) stderr += chunk.toString('utf8') })
          const timer = setTimeout(() => { stream.close(); resolveResult({ stdout, stderr, exitCode: null, result: 'result-unknown' }); client.end() }, this.config.execTimeoutMs ?? 60_000)
          stream.once('close', (code: number | null) => { clearTimeout(timer); client.end(); resolveResult({ stdout, stderr, exitCode: code, result: 'known' }) })
        })
      })
      client.connect({
        host: host.host, port: host.port, username: host.user,
        readyTimeout: this.config.connectTimeoutMs ?? 15_000,
        ...host.password === undefined ? {} : { password: host.password },
      })
    })
  }
  private async load(): Promise<void> { try { const value: unknown = JSON.parse(await readFile(this.path, 'utf8')); if (!isStore(value)) throw new Error('ssh: unsupported configuration format'); this.store = value } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error } }
  private persist(): Promise<void> { return writeFileAtomic(this.path, JSON.stringify(this.store), { mode: 0o600, dirMode: 0o700 }) }
}
function isStore(value: unknown): value is Store { return typeof value === 'object' && value !== null && (value as { version?: unknown }).version === 1 && Array.isArray((value as { hosts?: unknown }).hosts) }
export default SshService
