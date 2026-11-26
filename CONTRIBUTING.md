# Contributing

Thank you for helping improve League Akari. Bug reports, focused fixes, and feature contributions are welcome.

## Before you begin

- Search existing issues before opening a new one. Include the app version, operating system, relevant logs, and clear reproduction steps for bug reports. Remove account names, tokens, and other personal data from logs.
- For substantial changes, open an issue first so the scope and expected behavior can be discussed.
- Keep pull requests focused. Describe the user-visible behavior, the reason for the change, and how you verified it.

## Local setup

Use Node.js 24 and Yarn 4. From the repository root:

```sh
corepack enable
yarn install --immutable
yarn dev
```

## Checks

Before submitting code changes, run the checks that apply to your change:

```sh
yarn format
yarn format:check
yarn typecheck
yarn test
```

Run `yarn build` when a change affects production bundling. Platform-specific packaging commands may require the matching operating system and native build tools.

Tests should cover observable behavior or important contracts. Avoid tests that only assert source text or mirror a trivial implementation detail. UI, packaging, and native behavior may also need a runtime check in addition to unit tests.

## Pull requests

Open fork-specific work against this repository. Changes intended for the upstream project should target its `dev` branch and follow the upstream maintainers' contribution process. Review your diff before submitting, keep unrelated formatting out of feature changes, and include test or build results in the pull request description.

AI-assisted contributions are welcome. Review generated changes carefully and take responsibility for their behavior, tests, and documentation.

## Project conventions

See [AGENTS.md](AGENTS.md) for the project architecture, module organization, UI conventions, and development guidance. See [PR_REQUIREMENTS.md](PR_REQUIREMENTS.md) for additional review expectations.
