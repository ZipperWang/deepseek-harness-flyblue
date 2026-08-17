# Agent Note：FlyBlue 在三个完整 preset 中交付原生 CodeGraph 工具

Status: implemented

[English](2026-08-12-flyblue-codegraph-tools.md) | 中文

## 问题

本分支里的编码 agent 仍用 `grep` / `glob` / `read` 发现结构。CodeGraph 已经能在本地建符号图并用一次调用回答这些问题，但 DeepSeek Harness 没有一等公民工具。若只把上游 MCP 服务接到 `dsh-mcp-client`，模型看到的是 `mcp__codegraph__codegraph_explore`，而且拿不到 CodeGraph 的 initialize 指引（客户端只桥工具），也就学不会停止爬文件。

## 决策

`@deepseek-ai/dsh-tool-codegraph` 是 `packages/codegraph/tool-codegraph` 里的 preset 平面消费者。它在 `ctx.tools` 上注册原生 `codegraph_explore`（外加可选 extras），并注册 `tool:codegraph` 系统提示词段。它不发布服务，因此像 `tool-web` 一样松散挂在 `standard`、`code`、`cordis` 中。`minimal` 不加载它。

引擎是钉死的 npm 依赖 `@colbymchenry/codegraph@1.5.0`，不是 PATH 上的 CLI，也不是指向本地 checkout 的 `link:`。`apply()` 总是成功：缺少 `.codegraph/` 或引擎加载失败时返回成功形态的指引。插件从不执行 `codegraph init`。

进程内分发使用 `CodeGraph.open({ readOnly: true })` 以及包内 `dist/mcp/index.js` 的 `ToolHandler`（公开入口不 re-export `ToolHandler`）。`isolation: auto` 在 Node 25+ 改走 `process.execPath` 下的随包 CLI，因为该版本上 tree-sitter WASM 可能把宿主 OOM。`projectPath` 必须解析到会话 workspace cwd 内。

## 考虑过的替代方案

**在三个 preset 里挂 MCP client 行。** 否决：公开名称难看，没有 initialize 提示词（agent 会继续 grep），而且三次 standing mount 会拉起三个 server。

**只包一层 PATH CLI。** 否决：FlyBlue 发行版应自带引擎。

**Host 平面的 `ctx.codegraph` 服务。** 延期：只消费的插件避免 realm 碰撞，对每个 preset fiber 一份只读打开缓存已经够用。

**让 agent 自动 `codegraph init`。** 否决：CodeGraph 把建索引当作用户决定；过早的 `isError` 或突然建索引会教错习惯。

## 后果

标准 / PTC / 创造的新会话能看到 `codegraph_explore`。PTC 的 Code Mode 从同一份 schema 得到 `tools.codegraph_explore`。用户仍需对每个仓库执行一次 `codegraph init`。升级 CodeGraph 是一次有意的 pin 提升，外加 `ToolHandler` / `isInitialized` 仍能解析的契约测试。

## 测试

`packages/codegraph/tool-codegraph/tests/` 覆盖路径约束、隔离、两种 driver、extra-tool 配置、Loader 组装、真实加载路径的命名空间守卫，以及钉死包的契约。explore 执行对着注入的 driver 测，因此 CI 不必解析真实仓库。

## 相关

- [工具编写](../../../../docs/cookbook/adding-a-tool.md)
- CodeGraph 的 MCP 指引在上游 `src/mcp/server-instructions.ts`；本包在 `src/prompt.ts` 持有面向 DSH 的改写。
