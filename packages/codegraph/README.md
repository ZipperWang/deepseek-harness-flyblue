# codegraph/ — semantic code-index tools

English | [中文](README.zh.md)

Model-facing CodeGraph tools over the bundled `@colbymchenry/codegraph` engine. There is no replaceable provider contract: the package opens the project's local `.codegraph/` index.

| Package | Role | ctx key |
|---|---|---|
| [`tool-codegraph/`](tool-codegraph/README.md) | Registers `codegraph_explore` (and optional extras) on `ctx.tools`. | (registers on `ctx.tools`) |

The child README owns the tool, prompt, and engine isolation contract.
