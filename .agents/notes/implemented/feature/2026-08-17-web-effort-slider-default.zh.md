# Agent Note: Web 默认附带 Claude 风格推理滑块

Status: implemented

[English](2026-08-17-web-effort-slider-default.md) | 中文

## 问题

发行版输入框的模型席位是 `@deepseek-ai/dsh-client-ui-model-selection` 的紧凑原生触发器。Flyblue 用户希望每个 Web 会话都带上 [DSH Claude Style Reasoning Slider](https://github.com/MEMZ-JZY/DSH-Claude-Style-Reasoning-Slider)，而不必对每个 profile 执行 `dsh plugin add`。

## 决策

`@deepseek-ai/dsh-web-app` 依赖嵌入的 [`third-party/dsh-client-ui-effort-slider`](../../../../third-party/dsh-client-ui-effort-slider)（`file:`，钉死 `7bfa52083ed36ccd012fe34710f345dde19e42db`），并在 `ui-model-selection` 旁插入默认启用的 `effort-slider` host 行。该包是树外 DSH 组合包：host 的 `index.js` 提供 `/effort-slider-assets/`，`dsh.client` 发现预构建的 `./client` 半边。

滑块以 `priority: -1` 注入 `conversation.input.model`，从而盖住原生输入框触发器。原生 `ui-model-selection` 继续挂载，以提供 `/model` 和 `ctx.modelDirectories`。滑动变祖器和大肥鱼保持关闭，直到用户打开。profile 或 home patch 可将 `effort-slider` 设为 `disabled: true`，以恢复原生触发器。

该插件不改写成 `@deepseek-ai/dsh-client-*` workspace 包：它已经是 `dsh.bundle` + `dsh.client` 产物；纯 JS 的 workspace 包会通不过 source-plane 解析门禁。

## 考虑过的替代方案

**交给 `dsh plugin --profile web add`。** 否决：已有 web profile 会继续用原生触发器；发行版默认必须落在随附的 web-app 层。

**给 `PROFILE_TEMPLATES.web` 加第三层组合包。** 否决：已经初始化的 web profile 仍是 `[dsh-base, dsh-web-app]`，不会自动多出一层。把该行折进 `dsh-web-app` 才能覆盖仍使用随附模板的每个 web profile。

**整行替换 `ui-model-selection`。** 否决：滑块消费 `ctx.modelDirectories`，且不注册 `/model`。

**把源码放进 `packages/client`。** 否决：官方客户端包约定要求 TypeScript、`tsdown`、invariants 和 100% 覆盖率。上游包是预构建的 ModuleLoader 产物。

## 后果

仍加载 `dsh-web-app` 的新建或已有 web profile，会在输入框模型席位上看到该滑块，**设置 → 通用设置**也会多出大肥鱼 thumb 开关。CLI、headless 和 ACP 组装不挂该行。停用 `effort-slider` 会恢复原生芯片，且不移除 `/model`。

## 测试

`verify-cordis-config` 要求该包出现在 `packages/bundle/web-app/package.json`；knip 在 web-app 中忽略它，因为该行只在 `cordis.patch.yml` 中指名。`third-party/` 与 `vendor/` 一样成为翻译配对的发现排除项：它是钉住的依赖目录树，不是持续演进的翻译源文档。渲染输入框模型芯片或**设置 → 通用设置**的组装后 Web 快照已按滑块触发器与大肥鱼行刷新。declared-reasoning 场景通过自己的 overlay 把推理声明契约钉在原生 `ui-model-selection` 菜单上，因此继续断言适配器公布的精确等级列表，而不是驱动滑块的界面。

## 相关

- [Web 输入框的会话模型选择](2026-07-24-web-session-model-selector.md)
- [默认模型跟随选择器](2026-08-07-default-model-follows-the-picker.md)
