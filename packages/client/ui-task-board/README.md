# @deepseek-ai/dsh-client-ui-task-board

English | [中文](README.zh.md)

Browser settings section for the Host-owned durable task ledger. The plugin registers `task-board` in `settings.section`, lists active and archived tasks in a segmented board, creates trimmed titles, renames and archives inline, and permanently deletes archived tasks behind a two-step confirmation through generated Typert remotes.

Each mutation receives a browser-generated UUID as its request id. Mutations apply optimistically and reconcile from the Host response, then reload the Host projection so the ledger stays authoritative; RPC failures render as an alert banner with retry.

## Model Experience

None, as this browser-side task-board projection registers no model-visible content.

#### KV Cache effect

None; task-board rendering and mutations do not participate in provider requests.

## Known Limitations and Deferred Work

- The section does not expose a restore action for archived tasks.
- The task list refreshes after local mutations only; changes made by another client are not pushed live.