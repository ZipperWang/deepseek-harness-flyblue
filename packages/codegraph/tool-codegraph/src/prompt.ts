/**
 * Model-facing CodeGraph copy: the `tool:codegraph` section and the explore
 * schema strings. Steers unique-identifier queries; open prose, a lone path,
 * and existence checks fail open in the engine.
 * @module @deepseek-ai/dsh-tool-codegraph/prompt
 */

/** Stable `tool:codegraph` section text (order 108). */
export const CODEGRAPH_PROMPT_TEXT = `Codegraph is a local SQLite symbol graph. Call \`codegraph_explore\` first on indexed source. Shown source is Read-equivalent (\`<n>\\t<line>\`), safe to \`edit\` — do not re-read those files or re-verify a clean hit with grep.

## Query
- Unique identifiers: \`AuthService loginUser\`, not "how does auth work".
- How X reaches Y: both unique names in one query (\`AuthService markSession\`).
- Need more: call again with names from the hit; treat that source as already read.
- Pass \`maxFiles\` when you already know the file and want a small dump.

## Do not
- Open prose, a lone file path, or "does X exist" — those token-match (a path \`driver.ts\` hits every \`drive\`; a fake name still returns \`exists\` / \`Symbol\`).
- A common verb alone (\`run\`, \`init\`, \`index\`) — pair it with a rare companion name.
- Reconstruct a flow by hand when the call path already names the hops.

## Fallback
- No \`.codegraph/\`: stop codegraph tools for this project; use read/grep/glob. Indexing is the user's decision (\`codegraph init\`); do not run it.
- Use read/grep for configs, docs, and when the hit is token soup (unrelated files, Map methods, helpers). Source text is live from disk; blast-radius line numbers can lag a just-saved file by about one second.`

/** Model-facing `codegraph_explore` tool description. */
export const EXPLORE_TOOL_DESCRIPTION =
  'PRIMARY TOOL — call first on indexed source: how a named symbol works, where it lives, how X reaches Y, or the symbols you will edit. '
  + 'Query is unique identifier names (a short "how X reaches Y" must still name both). '
  + 'Returns line-numbered source plus the call path. Treat shown source as already Read; do not re-open those files.'

/** Model-facing `query` parameter description. */
export const EXPLORE_QUERY_DESCRIPTION =
  'Unique symbol names that span the question, e.g. "AuthService loginUser" or "how AuthService reaches markSession". '
  + 'Not open prose, a lone path, or an existence check.'
