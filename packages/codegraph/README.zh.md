# codegraph/：语义代码索引工具

[English](README.md) | 中文

面向模型的 CodeGraph 工具，基于发行版附带的 `@colbymchenry/codegraph` 引擎。没有可替换的提供方约定：本包打开项目本地的 `.codegraph/` 索引。

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`tool-codegraph/`](tool-codegraph/README.md) | 在 `ctx.tools` 上注册 `codegraph_explore`（以及可选的额外工具）。 | （注册到 `ctx.tools`） |

子级 README 负责工具、提示词和引擎隔离约定。
