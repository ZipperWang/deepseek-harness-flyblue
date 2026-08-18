# @deepseek-ai/dsh-client-ui-ssh

[English](README.md) | 中文

用于 SSH 清单和审慎命令执行的 loopback 浏览器设置区段。插件在 `settings.section` 中注册 `ssh`，通过 `ssh.list()` 加载不含密钥的主机，并通过 `ssh.exec()` 发送所选主机 ID 和命令。

命令结果显示捕获的 stdout 和 stderr。分发后失败会包含 `[result unknown]`，保留 Host 服务的警告：不得自动重复结果不确定的非幂等命令。

## 模型体验

无，因为该浏览器端 SSH 投影不注册模型可见内容。

#### KV Cache 影响

无；浏览器 SSH 操作不参与提供方请求。

## 已知限制与暂缓事项

- 区段可以列出主机和执行命令，但不能创建、编辑或删除主机记录。
- 命令以一个完整字符串提交；区段不提供交互终端、流式输出、取消或命令历史。
