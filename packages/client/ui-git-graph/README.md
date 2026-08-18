# @deepseek-ai/dsh-client-ui-git-graph

English | [中文](README.zh.md)

Browser settings section for the first registered workspace's Git status and commit history. The plugin registers `git-graph` in `settings.section`, reads `workspaceGit.status()` and `workspaceGit.graph()` through generated remotes, and renders RPC failures as an alert.

The section is a read-only client projection. Workspace identity comes from the shared workspace source, while Git access and safety remain owned by `@deepseek-ai/dsh-workspace-git` on the Host.

## Model Experience

None, as this browser-side Git projection registers no model-visible content.

#### KV Cache effect

None; rendering Git status and history does not participate in provider requests.

## Known Limitations and Deferred Work

- The section always selects the first registered workspace and provides no workspace picker.
- The current UI shows status and history only; branch and index mutations exposed by the Host service are not presented.
