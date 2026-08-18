# @deepseek-ai/dsh-client-ui-workspace-inspector

English | [中文](README.zh.md)

Browser settings section for bounded inspection of the first registered workspace. The plugin registers `workspace-inspector` in `settings.section`, lists one directory at a time through `workspaceFiles.tree()`, searches filenames through `workspaceFiles.search()`, and opens text previews through `workspaceFiles.preview()`.

The listing supports breadcrumb navigation, file-size labels, and a two-pane preview that shows the path, a version token, and a truncation mark when the Host reports one. All path authorization, link rejection, preview bounds, and version metadata remain Host responsibilities. The section is read-only; it displays RPC failures as an alert banner with retry.

## Model Experience

None, as this browser-side workspace-file projection registers no model-visible content.

#### KV Cache effect

None; workspace browsing does not participate in provider requests.

## Known Limitations and Deferred Work

- The section always selects the first registered workspace and provides no workspace picker.
- The section does not expose create, rename, save, or delete controls.
