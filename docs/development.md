# Development

## Environment

- Node.js 22.23.0 is the release-validation version; another compatible Node.js 22 release may work.
- npm 10+ and Git 2.40+ are required.
- The 3D viewer targets desktop browsers with WebGL 2.

## Setup

```bash
nvm use
npm ci
npm run dev
```

Do not commit `.env`, dependency directories, framework caches, local build output, generated repository bundles, or private source data.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | application and workspace type checking |
| `npm run test:unit` | workspace and application unit tests |
| `npm run build` | Cloudflare Worker-compatible production build |
| `npm run test:web` | rendered-HTML checks |
| `npm run test` | unit tests, build, and rendered HTML |
| `npm run check` | complete local release gate |
| `npm run assets:city-kit` | regenerate original city-kit assets |

## Clean release verification

From a clean checkout:

```bash
npm ci
npm audit --audit-level=high
npm run check
git diff --check
```

The release process additionally scans the complete Git history for secrets and personal paths, audits Actions logs and artifacts, verifies asset hashes and licenses, inspects screenshots, and checks the complete pull-request diff.

## Architecture

The CLI and analyzers live under `apps/` and `packages/`. The Vinext viewer is in `app/`. Generated public demo bundles are under `public/projects/`; arbitrary generated bundles are ignored.

Read [Architecture](ARCHITECTURE.md), [Data format](DATA_FORMAT.md), and [Contributing](../CONTRIBUTING.md) before changing semantic behavior.
