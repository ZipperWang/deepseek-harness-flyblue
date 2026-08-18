import { useEffect, useState } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
interface Host { id: string; alias: string; host: string; port: number; user: string; auth: string }
interface Result { stdout: string; stderr: string; exitCode: number | null; result: 'known' | 'result-unknown' }
export interface SshInjected {
  list: () => Promise<RemoteResult<Host[]>>
  exec: (id: string, command: string) => Promise<RemoteResult<Result>>
}
/** Render loopback-only SSH inventory and a deliberate command console. */
export function SshSection({ t, list, exec }: PropsLocale<'ssh'> & InjectFace<SshInjected>) {
  const [hosts, setHosts] = useState<Host[]>([])
  const [hostId, setHostId] = useState('')
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string>()
  useEffect(() => {
    void list().then((result) => {
      if (result.ok) { setHosts(result.value); setHostId(result.value[0]?.id ?? '') }
      else setError(result.error.message)
    })
  }, [list])
  return (
    <section>
      <h2>{t('title')}</h2>
      <p>{t('intro')}</p>
      {error !== undefined && <p role="alert">{error}</p>}
      <label>Host <select value={hostId} onChange={event => setHostId(event.target.value)}>
        {hosts.map(host => <option key={host.id} value={host.id}>{host.alias} ({host.user}@{host.host}:{host.port})</option>)}
      </select></label>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (hostId === '') return
        void exec(hostId, command).then((result) => {
          if (!result.ok) setError(result.error.message)
          else setOutput(`${result.value.stdout}${result.value.stderr}${result.value.result === 'result-unknown' ? '\n[result unknown]' : ''}`)
        })
      }}>
        <input aria-label="SSH command" value={command} onChange={event => setCommand(event.target.value)} />
        <button type="submit">Run</button>
      </form>
      {output !== '' && <pre>{output}</pre>}
    </section>
  )
}
