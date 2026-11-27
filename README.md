# Tactibellum

> **🚧 Work in Progress / Under Construction**

[![CI](https://github.com/KyleDerZweite/tactibellum/actions/workflows/ci.yml/badge.svg)](https://github.com/KyleDerZweite/tactibellum/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/KyleDerZweite/tactibellum/actions/workflows/deploy-pages.yml/badge.svg?branch=main)](https://github.com/KyleDerZweite/tactibellum/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Status: WIP](https://img.shields.io/badge/status-WIP-amber)](PROJECT_SPEC.md)

Tactibellum is a browser-based replay workspace for Mechabellum. Choose or drop a local `.grbr` file. Replay files stay on your device. The [project spec](PROJECT_SPEC.md) outlines replay analysis and the demo.

## Development

Use Node.js 24 and the pnpm version declared in [package.json](package.json).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm typecheck
pnpm lint
pnpm test
VITE_BASE_PATH=/tactibellum/ pnpm build
VITE_BASE_PATH=/tactibellum/ pnpm preview
```

## Hosting

For GitHub Pages, select **GitHub Actions** under **Settings → Pages → Build and deployment**. Pushes to `main` run the checks and deploy the resulting `dist/` artifact under the repository path.

For self-hosting, build the image and open http://localhost:8080/.

```sh
docker build -t tactibellum .
docker run --rm -p 8080:80 tactibellum
```

## Community resources

- [Mechabellum Wiki](https://wiki.mbxmas.com/)
- [Mechabellum Companion](https://mechabellum-companion.netlify.app/)
- [Sasha Learns](https://sashalearns.com/) and its [match archive](https://sashalearns.com/results?view=matches&window=50). Replay downloads require an account and may contain player names.

Tactibellum is an unofficial fan project. It has no affiliation with or endorsement from Game River or Dreamhaven. Mechabellum belongs to its respective rights holders. Tactibellum's source code is available under the [MIT License](LICENSE).
