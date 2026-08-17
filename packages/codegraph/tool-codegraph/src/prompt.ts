/**
 * System-prompt guidance that steers the model to `codegraph_explore` before
 * file-by-file discovery. Adapted from CodeGraph's MCP initialize instructions
 * for this harness's tool names.
 * @module @deepseek-ai/dsh-tool-codegraph/prompt
 */

/** Stable `tool:codegraph` section text (order 108). */
export const CODEGRAPH_PROMPT_TEXT = `Codegraph is a local SQLite knowledge graph of symbols, edges, and files in the workspace. Use it BEFORE and while editing indexed source — one call returns verbatim line-numbered source plus call paths and blast radius.

## One tool: codegraph_explore — use it instead of reading files

\`codegraph_explore\` is Read-equivalent. Pass a natural-language question or a bag of symbol/file names. It returns the verbatim source of the relevant symbols grouped by file (the same \`<n>\\t<line>\` shape \`read\` gives you, safe to \`edit\` from), plus the call path among them (including dynamic-dispatch hops grep cannot follow) and a blast-radius summary.

Call \`codegraph_explore\` before \`read\` or \`grep\` on indexed code. One call usually answers the question. Do not reconstruct a flow by hand and do not re-verify codegraph results with grep.

## How to query

- Almost any question — how X works, architecture, a bug, where/what is X, or surveying an area — \`codegraph_explore\` with the relevant names or a short question.
- How X reaches Y — name the symbols that span the flow in one query.
- Reading or editing a file/symbol you can name — put that name or path in the query.
- Need more? Call \`codegraph_explore\` again with more specific names and treat the returned source as already read.

## Limitations

- If a result says the project is not indexed (no \`.codegraph/\`), stop calling codegraph tools for that project for the rest of the session and use \`read\`/\`grep\`/\`glob\` there instead. Indexing is the user's decision — mention they can run \`codegraph init\` if it comes up, but do not run it yourself.
- The index lags file writes by about one second.
- Cross-file resolution is best-effort name matching; ambiguous calls may return multiple candidates.
- Reserve \`read\`/\`grep\` for configs, docs, or a specific detail codegraph did not cover.`
