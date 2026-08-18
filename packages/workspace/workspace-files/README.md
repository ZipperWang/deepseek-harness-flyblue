# @deepseek-ai/dsh-workspace-files

English | [中文](README.zh.md)

Loopback Typert service for workspace-ID-scoped file inspection and mutations. Every operation resolves a registered workspace first. Relative-path checks reject traversal, `.git`, symbolic links, and targets whose real path escapes the workspace.

The service lists one directory level, reads bounded UTF-8 previews, searches filenames, performs version-checked full-text saves, creates new files without overwriting, renames entries, and removes confirmed paths. Rename and remove require explicit confirmation where the operation is destructive; stale saves fail with `workspace-files: stale-write`.

## Configuration

| Key | Default | Meaning |
| --- | --- | --- |
| `previewBytes` | `1048576` | Maximum bytes read for one text preview. |
| `searchResultLimit` | `200` | Maximum matches returned by one filename search. |
| `searchScanLimit` | `10000` | Maximum entries examined by one filename search. |

## Model Experience

None, as the loopback file service serves browser requests and registers no model-visible content.

#### KV Cache effect

None; workspace-file RPCs do not assemble or send model requests.

## Known Limitations and Deferred Work

- Preview and save are UTF-8 text operations; binary delivery requires a separate loopback route owned outside this package.
- Saves replace the complete file and use metadata-derived version tokens; the service provides no patch merge or conflict resolution.
- Search matches filenames only and does not return an explicit truncation indicator when a configured scan or result limit is reached.
