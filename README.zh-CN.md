<div align="center">
  <img
    src="https://github.com/LeagueAkari/LeagueAkari/raw/HEAD/pictures/logo.png"
    width="128"
    height="128"
    alt="League Akari 图标"
  />
  <h1>League Akari</h1>
  <p>基于《英雄联盟》客户端更新 API（LCU）的玩家工具。</p>
</div>

<p align="center"><a href="README.md">English</a> | <a href="README.zh-CN.md">简体中文</a></p>

本仓库是 [LeagueAkari/LeagueAkari](https://github.com/LeagueAkari/LeagueAkari) 的社区 fork，增加了 OP.GG 窗口的局域网手机投射功能。上游仓库仍是官方版本发布和项目通用信息的来源。

## 功能

- 查询受支持的《英雄联盟》客户端玩家和对局信息。
- 配置英雄选择、客户端流程、悬浮窗和桌面工具。
- 在 OP.GG 窗口查看英雄推荐，并同步到同一局域网内的手机。
- 使用对局进行、辅助窗口和技能冷却计时器窗口。

手机端的启用、同步和使用方法见[局域网手机端指南](docs/lan-mobile.md)。

## 下载与支持

官方 Windows 和 macOS 版本发布在[上游仓库的 Releases 页面](https://github.com/LeagueAkari/LeagueAkari/releases)。本 fork 可能包含尚未进入官方版本的改动。

一般情况下无需管理员权限。部分 Windows 快捷键、悬浮窗和客户端窗口工具可能需要管理员权限。目前支持大部分 Riot 运营的服务器地区，不支持腾讯运营的服务器。

本 fork 的问题反馈和功能建议请使用[此仓库的 issue 页面](https://github.com/cosmosouo/LeagueAkari-cosmos/issues)。上游项目相关问题请参阅 [LeagueAkari/LeagueAkari](https://github.com/LeagueAkari/LeagueAkari)。

## 开发

项目使用 Node.js 24、Yarn 4、Electron、Vue 3 和 TypeScript。启用 Corepack 并安装锁定版本的依赖后，即可启动应用：

```sh
corepack enable
yarn install --immutable
yarn dev
```

常用检查和构建命令：

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

`yarn format` 按仓库的 Prettier 配置整理代码；提交前运行 `yarn format:check` 检查格式。`yarn build` 生成应用构建文件，平台专用命令还会生成可分发安装包。

源码分为 Electron 主进程、五个渲染窗口、共享服务和类型，以及手机网页。仓库结构与架构说明见 [AGENTS.md](AGENTS.md)，贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 致谢

League Akari 的开发参考了以下项目和资料：

| 项目                                                                                     | 简介                                             |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [Pengu Loader](https://github.com/PenguLoader/PenguLoader)                               | 面向《英雄联盟》客户端的 JavaScript 插件加载器。 |
| [LCU 和 Riot Client API 文档](https://github.com/KebsCS/lcu-and-riotclient-api)          | 社区维护的 API 文档。                            |
| [CommunityDragon](https://www.communitydragon.org/documentation/assets)                  | 游戏资源文档和资料。                             |
| [Seraphine](https://github.com/Zzaphkiel/Seraphine)                                      | 游戏辅助工具的集成实践。                         |
| [fix-lcu-window](https://github.com/LeagueTavern/fix-lcu-window)                         | 修正客户端窗口尺寸的工具。                       |
| [Joi](https://github.com/watchingfun/Joi)                                                | 一款《英雄联盟》助手。                           |
| [vscode-league-respawn-timer](https://github.com/Coooookies/vscode-league-respawn-timer) | Visual Studio Code 复活计时器扩展。              |
| [LeaguePrank](https://github.com/LeagueTavern/LeaguePrank)                               | 趣味功能的灵感来源。                             |

## 许可证与免责声明

本项目采用 [MIT 许可证](LICENSE)。League Akari 是独立的社区项目，与 Riot Games 无关联，也未获其赞助或认可。《英雄联盟》和 Riot Games 是 Riot Games, Inc. 的商标。客户端 API 可能随版本变化；使用本软件时请自行判断，并遵守适用的游戏和服务条款。
