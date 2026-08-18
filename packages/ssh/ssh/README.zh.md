# @deepseek-ai/dsh-ssh

[English](README.md) | 中文

由 Host 管理的 SSH 主机存储和单次命令执行服务。`ssh` Typert 服务公开仅限 loopback 的 list、put、remove 和 exec 方法。主机记录保存在 `$DSH_HOME/dsh-ssh.json`，文件和目录仅允许所有者访问；浏览器列表不返回密码和私钥路径。

`exec` 最多分发一次命令。分发前连接失败会拒绝调用。分发后连接丢失或超时会返回 `result: "result-unknown"`，调用方因此可以避免重放远端效果尚不确定的命令。

## 配置

| Key | 默认值 | 含义 |
| --- | --- | --- |
| `connectTimeoutMs` | `15000` | 建立连接的最长时间。 |
| `execTimeoutMs` | `60000` | 单次已分发命令的最长时间。 |
| `outputLimitBytes` | `2097152` | 分别应用于 stdout 和 stderr 的捕获上限。 |
| `idleTimeoutMs` | `1800000` | 预留的空闲连接生命周期。 |

## 模型体验

通过 `@deepseek-ai/dsh-tool-ssh` 间接产生；后者拥有模型可见的 schema、结果和呈现。

#### KV Cache 影响

该服务不增加请求 token；加载或卸载其工具消费者可能改变可见工具 schema 前缀。

## 已知限制与暂缓事项

- 可以保存私钥路径，但命令连接尚未把它加载到 `ssh2`；当前执行要求服务器支持密码认证。
- `idleTimeoutMs` 为连接池预留；目前每次调用都会打开并关闭一个连接。
- 服务构造期间会异步开始加载持久化主机，因此启动时立即得到的空列表不能证明没有已配置主机。
