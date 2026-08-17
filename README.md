# DeepSeek Harness FlyBlue Edition

English | [中文](README.zh.md)

This repository is a fork distribution of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), customized and maintained by FlyBlue at [github.com/onefl666/deepseek-harness-flyblue](https://github.com/onefl666/deepseek-harness-flyblue). The upstream project is developed by [DeepSeek AI](https://deepseek.com).

DeepSeek Harness (`dsh`) is an open-source agent harness. It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/onefl666/deepseek-harness-flyblue.git
cd deepseek-harness-flyblue
pnpm install
pnpm run build
pnpm dsh web
```

The command starts the Web UI, served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).

Standard, PTC, and Create modes include `codegraph_explore` from the bundled [`@colbymchenry/codegraph`](https://www.npmjs.com/package/@colbymchenry/codegraph) engine. Each workspace still needs a local `.codegraph/` index. The Web UI can create it from the blank-session prompt or **Settings → Code index**; CLI and headless users run `codegraph init`. Without an index the tool stays listed and tells the agent to use ordinary file tools.

## Community and support

- Feel free to submit feedback or bug reports through [Issues](https://github.com/onefl666/deepseek-harness-flyblue/issues).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">upstream DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
