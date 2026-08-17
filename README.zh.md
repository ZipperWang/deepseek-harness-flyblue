# DeepSeek Harness FlyBlue Edition

[English](README.md) | 中文

本仓库是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的分支发行版，由 FlyBlue 定制维护，仓库见 [github.com/onefl666/deepseek-harness-flyblue](https://github.com/onefl666/deepseek-harness-flyblue)。上游项目由 [DeepSeek AI](https://deepseek.com) 开发。

DeepSeek Harness（`dsh`）是一款开源 agent harness（智能体框架）。它采用**一切皆插件**的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

## 开发者预览

DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

## 运行

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/onefl666/deepseek-harness-flyblue.git
cd deepseek-harness-flyblue
pnpm install
pnpm run build
pnpm dsh web
```

该命令会启动 Web UI，默认地址为 `http://127.0.0.1:3080`。详见 [Web UI 指南](docs/user/guide/index.md)。输入框的模型芯片是 Claude 风格推理滑块（[DSH Claude Style Reasoning Slider](https://github.com/MEMZ-JZY/DSH-Claude-Style-Reasoning-Slider)）；在 web profile patch 中停用 `effort-slider` 行即可恢复原生触发器。

标准模式、PTC 模式和创造模式默认提供发行版附带的 [`@colbymchenry/codegraph`](https://www.npmjs.com/package/@colbymchenry/codegraph) 引擎上的 `codegraph_explore`。每个 workspace 仍需本地 `.codegraph/` 索引。Web UI 可从空白会话提示条、**设置 → 代码索引**或 `/codegraph-init` 创建索引；CLI 与 headless 用户自行运行 `codegraph init`。没有索引时工具仍会列出，并让 agent 改用普通文件工具。

## 社区与支持

- 欢迎通过 [Issues](https://github.com/onefl666/deepseek-harness-flyblue/issues) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入上游 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="assets/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="assets/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="assets/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
