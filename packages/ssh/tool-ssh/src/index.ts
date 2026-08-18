/** Optional agent-facing SSH tool consumer. */
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { SshHostId, type SshService } from '@deepseek-ai/dsh-ssh'

export const name = 'tool-ssh'
export const inject = ['tools']
/** Register SSH tools only when the host composition provides `ctx.ssh`. */
export function apply(ctx: Context): void {
  const ssh = ctx.get('ssh') as SshService | undefined
  if (ssh === undefined) return
  ctx.tools.register(defineTool({ name: 'ssh_list', description: 'List configured remote SSH hosts. Secrets are never returned.', parameters: {}, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, execute: () => Promise.resolve(ssh.list().map(host => `${host.alias} (${host.user}@${host.host}:${host.port})`).join('\n') || '(no SSH hosts)'), presentCall: () => ({ card: 'generic', title: 'List SSH hosts', kind: 'read' }) }))
  ctx.tools.register(defineTool({ name: 'ssh_exec', description: 'Run one command exactly once on a configured SSH host. A result-unknown response means the connection dropped after dispatch; do not repeat non-idempotent commands automatically.', parameters: { host_id: { type: 'string', required: true, description: 'Configured SSH host id.' }, command: { type: 'string', required: true, description: 'Command to run remotely.' } }, output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] }, execute: async (args) => { const result = await ssh.exec(SshHostId(args.host_id), args.command); return `${result.stdout}${result.stderr}${result.result === 'result-unknown' ? '\n[result unknown]' : ''}` }, presentCall: args => ({ card: 'terminal', title: `SSH ${args.host_id}`, rawInput: args.command }) }))
}
