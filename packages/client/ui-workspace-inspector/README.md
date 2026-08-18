# @deepseek-ai/dsh-client-ui-workspace-inspector

English | [中文](README.zh.md)

Browser settings section for bounded inspection of the first registered workspace. The plugin registers `workspace-inspector` in `settings.section`, lists the workspace root through `workspaceFiles.tree()`, and opens text previews through `workspaceFiles.preview()`.

All path authorization, link rejection, preview bounds, and version metadata remain Host responsibilities. The section displays RPC failures as an alert and marks a preview when the Host reports truncation.

## Model Experience

None, as this browser-side workspace-file projection registers no model-visible content.

#### KV Cache effect

None; workspace browsing does not participate in provider requests.

## Known Limitations and Deferred Work

- The section always selects the first registered workspace and provides no workspace picker.
- The current tree is limited to root entries and provides no directory navigation, search, editing, rename, creation, or deletion controls.
