# codegraph/：语义代码索引工具

[English](README.md) | 中文

面向模型的 CodeGraph 工具，以及 Web host 索引生命周期，基于发行版附带的 `@colbymchenry/codegraph` 引擎。没有可替换的提供方约定：工具打开项目本地的 `.codegraph/` 索引。

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`tool-codegraph/`](tool-codegraph/README.md) | 在 `ctx.tools` 上注册 `codegraph_explore`（以及可选的额外工具）。 | （注册到 `ctx.tools`） |
| [`codegraph-index/`](codegraph-index/README.md) | Web host 索引生命周期：状态、用户 init、可选自动 init。 | `codegraphIndex` |

子级 README 负责工具、提示词和引擎隔离约定。索引管理器在 host 平面，不是模型工具。
