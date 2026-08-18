# @deepseek-ai/dsh-client-ui-git-graph

English | [中文](README.zh.md)

Browser settings section for the first registered workspace's Git working tree, branches, and commit graph. The plugin registers `git-graph` in `settings.section`, reads `workspaceGit.status()`, `workspaceGit.graph()`, and `workspaceGit.branches()` through generated remotes, and presents staged/unstaged/untracked/conflict changes with stage, unstage, and confirmed discard actions. The branch card switches local branches and creates new ones at the current HEAD.

The section is a presentation-only client projection: workspace identity comes from the shared workspace source, Git access and safety remain owned by `@deepseek-ai/dsh-workspace-git` on the Host, and RPC failures render as an alert banner with retry.

## Model Experience

None, as this browser-side Git projection registers no model-visible content.

#### KV Cache effect

None; rendering Git state and history does not participate in provider requests.

## Known Limitations and Deferred Work

- The section always selects the first registered workspace and provides no workspace picker.
- The commit graph renders lanes and merge trunks without horizontal connector curves.
