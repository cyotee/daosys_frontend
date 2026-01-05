DaoSYS Frontend is a Next.js “development console” for interacting with deployed contracts.

It supports:
- Loading contract ABIs from a local Foundry/Hardhat project (auto-bundled into `public/local-abis.json`).
- Loading example contractlists (bundled into `public/contractlists/`).
- Reading/writing contract methods via wagmi/viem.

## Install

```bash
npm install
```

## Quickstart (this monorepo)

From the `indexedex` repo root:

```bash
# Start the dev console in local mode (auto-discovers Foundry/Hardhat)
npm --prefix lib/daosys/lib/daosys_frontend run dev:local
```

If you need to point it at a specific project directory:

```bash
node lib/daosys/lib/daosys_frontend/bin/cli.js --local --project-dir=lib/daosys/example dev
```

If your artifacts directory is non-standard (or you just want to force it):

```bash
# Foundry example
node lib/daosys/lib/daosys_frontend/bin/cli.js --local --project-dir=lib/daosys/example --out-dir=lib/daosys/example/out dev

# Hardhat example
node lib/daosys/lib/daosys_frontend/bin/cli.js --local --project-dir=path/to/hardhat --out-dir=path/to/hardhat/artifacts dev
```

To just bundle ABIs without starting the server:

```bash
node lib/daosys/lib/daosys_frontend/bin/cli.js --local bundle
```

To watch artifacts and keep `public/local-abis.json` up to date:

```bash
node lib/daosys/lib/daosys_frontend/bin/cli.js --local watch
```

## Run (standard)

```bash
npm run dev
```

## Run (local project mode)

Local mode scans your current project (Foundry or Hardhat) and bundles ABIs for the UI.

From this repo:

```bash
npm run dev:local
```

Or via the CLI (useful from other folders):

```bash
npx daosys-frontend --local dev
```

### Local ABI bundling details

- Bundler: [scripts/bundle-local-abis.js](scripts/bundle-local-abis.js)
- Output: `public/local-abis.json`
- Watcher: [scripts/watch-abis.js](scripts/watch-abis.js)

If discovery fails or your project has a non-standard layout:

```bash
npx daosys-frontend --local --project-dir=/path/to/project dev
npx daosys-frontend --local --out-dir=/path/to/foundry/out dev
```

## CLI

```bash
npx daosys-frontend --help
```

Key commands:
- `dev` / `run`: start Next dev server
- `build`: build the app
- `start`: run the built app
- `export`: build for static export (IPFS-oriented)
- `bundle`: bundle ABIs only (no server)
- `watch`: watch + bundle ABIs only (no server)

Common flags:
- `--local`: enable ABI discovery from your current project
- `--project-dir=PATH`: override discovery root
- `--out-dir=PATH`: override artifacts directory (passed through to bundler + watcher)
- `--no-bundle`: skip initial bundling
- `--no-watch`: disable ABI watching in dev mode

## Debug logging

Runtime debug logging is gated behind `NEXT_PUBLIC_DEBUG=true`.

```bash
NEXT_PUBLIC_DEBUG=true npm run dev
```

## Tests

```bash
npm test
```
