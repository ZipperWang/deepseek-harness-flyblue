# @deepseek-ai/dsh-tool-ssh

English | [中文](README.zh.md)

Optional model-facing consumer of `ctx.ssh`. When the SSH service is present, the plugin registers `ssh_list` for secret-free host discovery and `ssh_exec` for one-shot remote command execution. When the service is absent, it registers no tools.

`ssh_exec` forwards one configured host id and command to the service. It returns captured stdout followed by stderr and appends `[result unknown]` when the connection is lost after dispatch. That marker instructs callers not to repeat a potentially non-idempotent command automatically.

## Model Experience

### Tool schemas

#### What the model sees

The model sees the generated [`ssh_list` and `ssh_exec` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-ssh) only while `ctx.ssh` is available.

#### Token effect

Fixed schema cost on every request while both tools are registered.

#### KV Cache effect

Prefix-stable while registration and schema order are unchanged; adding or removing the SSH service may invalidate reuse from the first changed schema token.

### Tool results

#### What the model sees

`ssh_list` returns one alias and `user@host:port` endpoint per configured host without secrets. `ssh_exec` returns the service-captured streams and the explicit unknown-result marker when applicable.

#### Token effect

Data-dependent result cost; command output is bounded by the SSH service's configured stream limits.

#### KV Cache effect

Tool results append after the cached request prefix and do not directly invalidate it.

### UI presentation

#### What the model sees

Nothing. Host listing uses a generic read card, while execution uses a terminal card derived from the host id and command arguments.

#### Token effect

Zero direct token effect because card rendering is client-side only.

#### KV Cache effect

None; UI presentation is outside the model request.

## Known Limitations and Deferred Work

- The tool cannot create or edit host records; host configuration remains a loopback browser operation.
- SSH private-key execution remains unavailable until the host service loads configured key material.
