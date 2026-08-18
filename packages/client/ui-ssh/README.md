# @deepseek-ai/dsh-client-ui-ssh

English | [中文](README.zh.md)

Loopback browser settings section for SSH host inventory and deliberate command execution. The plugin registers `ssh` in `settings.section`, loads secret-free hosts through `ssh.list()`, creates and edits host records (password or key auth) through `ssh.put()`, and removes them through `ssh.remove()`. A selected host drives the command console, which sends one command at a time through `ssh.exec()` and appends one terminal block per executed command with its captured streams and exit status.

The console never auto-retries. A post-dispatch failure keeps the captured partial output and renders a warning that the result is unknown, preserving the Host service's warning that an uncertain non-idempotent command must not be repeated automatically.

## Model Experience

None, as this browser-side SSH projection registers no model-visible content.

#### KV Cache effect

None; browser SSH operations do not participate in provider requests.

## Known Limitations and Deferred Work

- The section runs one command at a time; it provides no interactive terminal, streaming output, or cancellation.
- Command history is session-local and resets with the settings panel.