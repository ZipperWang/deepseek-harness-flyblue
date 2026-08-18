# @deepseek-ai/dsh-client-ui-ssh

English | [中文](README.zh.md)

Loopback browser settings section for SSH inventory and deliberate command execution. The plugin registers `ssh` in `settings.section`, loads secret-free hosts through `ssh.list()`, and sends a selected host id and command through `ssh.exec()`.

The command result displays captured stdout and stderr. A post-dispatch failure includes `[result unknown]`, preserving the Host service's warning that an uncertain non-idempotent command must not be repeated automatically.

## Model Experience

None, as this browser-side SSH projection registers no model-visible content.

#### KV Cache effect

None; browser SSH operations do not participate in provider requests.

## Known Limitations and Deferred Work

- The section can list hosts and execute commands but cannot create, edit, or remove host records.
- Commands run as one submitted string; the section provides no interactive terminal, streaming output, cancellation, or command history.
