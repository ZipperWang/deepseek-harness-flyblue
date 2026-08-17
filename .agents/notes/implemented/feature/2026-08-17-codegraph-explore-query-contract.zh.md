# Agent Note: CodeGraph explore query contract

Status: implemented

[English](2026-08-17-codegraph-explore-query-contract.md) | 中文

## 问题

`@colbymchenry/codegraph@1.5.0` 的 explore 按 token 匹配查询。开放散文、单独文件路径和存在性探查会 fail-open：“how does indexing work” 会落到无关的 `index` 符号；`driver.ts` 会命中每个 `drive`；虚构名字仍会返回 `exists` / `Symbol`。把这些写法当作默认查询会浪费一轮，并带出引擎的大段源码。

## 决策

面向模型的查询约定在 `packages/codegraph/tool-codegraph/src/prompt.ts`：`CODEGRAPH_PROMPT_TEXT`、`EXPLORE_TOOL_DESCRIPTION` 和 `EXPLORE_QUERY_DESCRIPTION`。查询必须是唯一标识符。“how X reaches Y” 必须点名两端。禁止开放散文、单独路径和存在性探查。干净的源码转储按 Read 等价处理。token-soup 命中和缺少 `.codegraph/` 时退回 `read` / `grep` / `glob`。发行 preset 仍然只列出 `codegraph_explore`。

[原生工具说明](2026-08-12-flyblue-codegraph-tools.md) 仍持有交付引擎、并禁止 agent 自行 `codegraph init` 的决策。

## 考虑过的替代方案

**默认打开 `extraTools`（`search` / `node` / `callers`）。** 否决：每个 extra schema 都是常驻的每请求成本，而且 query 点名符号时 explore 已经返回 callers、callees 和影响面。

**改随包引擎的检索。** 否决：钉死版本是 `1.5.0`；改检索是另一次升级，不是分发文案修复。

**继续教自然语言和路径查询。** 否决：那些写法就是测到的失败模式。

## 后果

标准 / PTC / 创造会话的固定前缀略短，并带有明确的禁止列表。仍用开放散文提问的模型可能浪费一轮；提示词现在点名了这种失败。extras 仍可在加载时按需打开。

## 测试

`packages/codegraph/tool-codegraph/tests/tool-codegraph.spec.ts` 把组装后的 `tool:codegraph` 段和 explore schema 字符串钉死在导出常量上。包 README 的逐字围栏引用该提示词。`docs/tool-catalog.md` 从同一份 description 重新生成。

## 相关

- [原生 CodeGraph 工具](2026-08-12-flyblue-codegraph-tools.md)
