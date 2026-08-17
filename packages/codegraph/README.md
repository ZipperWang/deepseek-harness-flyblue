# codegraph/ — semantic code-index tools

English | [中文](README.zh.md)

Model-facing CodeGraph tools and the Web host index lifecycle over the bundled `@colbymchenry/codegraph` engine. There is no replaceable provider contract: the tools open the project's local `.codegraph/` index.

| Package | Role | ctx key |
|---|---|---|
| [`tool-codegraph/`](tool-codegraph/README.md) | Registers `codegraph_explore` (and optional extras) on `ctx.tools`. | (registers on `ctx.tools`) |
| [`codegraph-index/`](codegraph-index/README.md) | Web host index lifecycle: status, user init, optional auto-init. | `codegraphIndex` |

The child README owns the tool, prompt, and engine isolation contract. The index manager is host-plane and is not a model tool.
