/** Client-safe SSH identifiers and host records. */
import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable SSH host identifier. */
export type SshHostId = Branded<'SshHostId'>

/**
 * Brand one SSH host id.
 * @param id - Serialized SSH host identifier.
 * @returns The identifier branded for SSH APIs.
 */
export const SshHostId = (id: string): SshHostId => id as SshHostId

/** User-owned SSH host configuration. */
export interface SshHost {
  id: SshHostId
  alias: string
  host: string
  port: number
  user: string
  password?: string
  privateKeyPath?: string
}

/** Secret-free browser and model projection. */
export type SshHostSummary = Omit<SshHost, 'password' | 'privateKeyPath'> & {
  auth: 'password' | 'key'
}
