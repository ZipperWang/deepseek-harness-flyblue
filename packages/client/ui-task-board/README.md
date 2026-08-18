# @deepseek-ai/dsh-client-ui-task-board

English | [中文](README.zh.md)

Browser settings section for the Host-owned durable task ledger. The plugin registers `task-board` in `settings.section`, lists active tasks, creates trimmed titles, and archives tasks through generated Typert remotes.

Each mutation receives a browser-generated UUID as its request id. After a successful create or archive, the section reloads the Host projection; RPC failures remain visible as an alert.

## Model Experience

None, as this browser-side task-board projection registers no model-visible content.

#### KV Cache effect

None; task-board rendering and mutations do not participate in provider requests.

## Known Limitations and Deferred Work

- The section hides archived tasks and does not expose restore, rename, or permanent removal actions.
- The task list refreshes after local mutations only; changes made by another client are not pushed live.
