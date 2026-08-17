# Use the Web UI

English | [中文](index.zh.md)

Start the Web UI through the [root README](../../../README.md#run); the command prints its URL. This guide begins after that server is running. The `dsh` process uses its invoking directory as the default filesystem location, but a fresh Web UI has no selected workspace until you add one.

## Configure a model

Open **Settings → Models**, enter a DeepSeek API key, and save it. The model route becomes usable immediately without restarting the server. The composer model chip is a Claude-style reasoning slider: pick the model, then Off / Low / Medium / High / Extra / Max. Disable the `effort-slider` profile row to restore the native trigger.

The [model configuration guide](./providers.md) covers other providers and custom OpenAI-compatible endpoints.

## Choose a workspace

Click **Choose workspace**, add the project directory where you started `dsh`, and select it. The session composer remains unavailable until a workspace is selected.

## Index the workspace

A new blank session on an unindexed workspace shows **Initialize** / **Dismiss** above the composer. Initialize creates `.codegraph/` so `codegraph_explore` can answer structural questions. `/codegraph-init` starts the same host job. **Settings → Code index** can start init later and can turn on auto-init for future sessions. CLI and headless users still run `codegraph init` themselves.

## Run a task

Start a session and send:

> Summarize this repository and identify its main packages.

The agent can read and edit workspace files, run commands, delegate work, and maintain a plan. The Web UI asks before operations that require approval under the active permission policy.

## Continue

- [Configure models](./providers.md)
- [Use the Python SDK](./python-sdk.md)
- [Use other CLI modes](../../../apps/cli/README.md)
- [Develop a plugin](../develop/basic/)
