<div align="center">
  <img
    src="https://github.com/LeagueAkari/LeagueAkari/raw/HEAD/pictures/logo.png"
    width="128"
    height="128"
    alt="League Akari logo"
  />
  <h1>League Akari</h1>
  <p>A League of Legends companion built around the League Client Update (LCU) API.</p>
</div>

<p align="center"><a href="README.md">English</a> | <a href="README.zh-CN.md">简体中文</a></p>

This repository is a community fork of [LeagueAkari/LeagueAkari](https://github.com/LeagueAkari/LeagueAkari). It includes a local-network mobile view for the OP.GG window. The upstream project remains the source for official releases and general project information.

## Features

- Look up player and match information from supported League of Legends clients.
- Configure champion select, client workflows, overlays, and desktop utilities.
- View champion recommendations in the OP.GG window and mirror them to a phone on the same local network.
- Use the ongoing-game, auxiliary, and cooldown-timer windows.

See [the local mobile guide](docs/lan-mobile.md) for setup, synchronization, and phone usage.

## Download and support

Official Windows and macOS releases are published on the [upstream Releases page](https://github.com/LeagueAkari/LeagueAkari/releases). This fork may contain changes that are not included in those releases.

Administrator privileges are not normally required. Some Windows shortcuts, overlays, and client-window utilities may require them. Most Riot-operated regions are supported; Tencent-operated servers are not supported.

For fork-specific bugs and requests, use [this repository's issue tracker](https://github.com/cosmosouo/LeagueAkari-cosmos/issues). For upstream project questions, see [LeagueAkari/LeagueAkari](https://github.com/LeagueAkari/LeagueAkari).

## Development

The project uses Node.js 24, Yarn 4, Electron, Vue 3, and TypeScript. Enable Corepack and install the locked dependencies before starting the app:

```sh
corepack enable
yarn install --immutable
yarn dev
```

Useful checks and builds:

```sh
yarn format
yarn format:check
yarn typecheck
yarn test
yarn storybook
yarn build
yarn build:win
yarn build:mac
```

`yarn format` applies the repository's Prettier configuration. Run `yarn format:check` before submitting changes. `yarn build` creates the application bundle; the platform-specific commands also create distributable packages.

The source is split between the Electron main process, five renderer windows, shared services and types, and the mobile web client. See [AGENTS.md](AGENTS.md) for the repository map and architecture notes, and [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

## Acknowledgements

League Akari was inspired by and builds on information from these projects and resources:

| Project                                                                                  | Description                                           |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [Pengu Loader](https://github.com/PenguLoader/PenguLoader)                               | A JavaScript plugin loader for the League client.     |
| [LCU and Riot Client API Docs](https://github.com/KebsCS/lcu-and-riotclient-api)         | Community-maintained API documentation.               |
| [CommunityDragon](https://www.communitydragon.org/documentation/assets)                  | Game asset documentation and resources.               |
| [Seraphine](https://github.com/Zzaphkiel/Seraphine)                                      | Integration approaches for League companion tools.    |
| [fix-lcu-window](https://github.com/LeagueTavern/fix-lcu-window)                         | A utility for correcting League client window sizing. |
| [Joi](https://github.com/watchingfun/Joi)                                                | A League of Legends assistant.                        |
| [vscode-league-respawn-timer](https://github.com/Coooookies/vscode-league-respawn-timer) | A respawn timer extension for Visual Studio Code.     |
| [LeaguePrank](https://github.com/LeagueTavern/LeaguePrank)                               | A source of inspiration for playful features.         |

## License and disclaimer

This project is distributed under the [MIT License](LICENSE). League Akari is an independent community project and is not affiliated with, sponsored, or endorsed by Riot Games. League of Legends and Riot Games are trademarks of Riot Games, Inc. The software interacts with client APIs that may change; use it at your own discretion and follow the applicable game and service terms.
