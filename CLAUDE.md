# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DaoSYS Frontend is a Next.js 13 web3 application for interacting with smart contracts. It enables developers to connect to deployed contracts, execute read/write functions, manage contract collections, and track transaction history. The app is serverless - all state persists to browser localStorage.

**Dual-mode operation:**
- **Local Development**: Load ABIs from Foundry/Hardhat build artifacts with auto-reload
- **IPFS/Static**: Deploy to IPFS for public access, load ABIs from on-chain bytecode metadata

## Build & Development Commands

```bash
# Standard development
npm run dev                     # Start dev server on port 3000
npm run build                   # Production build
npm run start                   # Start production server
npm run lint                    # Run ESLint

# Local development with contract artifacts
npm run dev:local               # Dev with local Foundry/Hardhat ABIs + watch mode
npm run build:local             # Build with local ABIs bundled
npm run bundle-abis             # Bundle ABIs only (no server)
npm run watch-abis              # Watch and auto-bundle ABIs

# IPFS deployment
npm run export                  # Build static export for IPFS

# CLI (from parent project or via npx)
npx daosys-frontend --local dev           # Dev with local ABIs + auto-watch
npx daosys-frontend --local --no-watch dev # Dev without ABI watching
npx daosys-frontend export                # Static export for IPFS
npx daosys-frontend bundle                # Bundle ABIs only
npx daosys-frontend --help                # Show all options
```

## Architecture

### Tech Stack
- **Next.js 13.4** with App Router (`src/app/`)
- **React 18** + **TypeScript 5.1**
- **Material-UI 5** for components
- **Wagmi 1.3 + Viem 1.4** for Web3
- **Rainbow Kit 1.0** for wallet UI
- **Redux Toolkit** for state management

### ABI Loading System

Three-tier ABI loading with automatic fallback:

1. **Local Artifacts** (development) - Bundled from Foundry `out/` or Hardhat `artifacts/`
2. **On-chain Metadata** - Sourcify verification or bytecode CBOR metadata via IPFS
3. **Manual Input** - Paste ABI JSON directly

**Build-time bundling** (`scripts/bundle-local-abis.js`):
- Scans for `foundry.toml` or `hardhat.config.js/ts`
- Reads compiled artifacts from configured output directory
- Bundles to `public/local-abis.json` for static access

**Watch mode** (`scripts/watch-abis.js`):
- Monitors artifacts directory for changes
- Auto-rebuilds manifest when contracts recompile
- Debounces rapid changes during compilation

### State Management Pattern

Redux state syncs bidirectionally with localStorage. Five feature slices:

| Slice | Purpose | localStorage Key |
|-------|---------|-----------------|
| `collectionsSlice` | Contract groupings | `redux::collections` |
| `contractsSlice` | Cached ABIs & metadata | `redux::contracts` |
| `tabsSlice` | Open contract interaction tabs | `redux::tabs` |
| `historySlice` | Transaction records | `redux::history` |
| `userPreferencesSlice` | Selected tab/collection | `redux::userPreferences` |

### Contract Loading Flow

The `useLoadContract` hook (`src/hooks/useLoadContract.ts`) handles contract interaction:

1. Validate address with Viem's `isAddress()`
2. Check for bundled local ABIs via `useLocalAbis` hook
3. Attempt metadata fetch from Sourcify or IPFS via `@ethereum-sourcify/contract-call-decoder`
4. Fall back to manual ABI input if metadata unavailable
5. Create Viem contract instance and store in Redux

### Provider Stack

Providers wrap the app in `src/app/providers.tsx`:
```
Redux Provider
└── WagmiConfig
    └── MUI ThemeProvider
        └── RainbowKitProvider
```

### Supported Networks

Configured in `src/app/providers.tsx`:
- Rollux Mainnet (chain ID: 570) - primary
- Ethereum Mainnet
- Goerli (when `NEXT_PUBLIC_ENABLE_TESTNETS=true`)

Custom chain configs in `src/networks/`.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_ENABLE_TESTNETS` | Enable Goerli testnet |
| `STATIC_EXPORT` | Enable static export mode (set by `npm run export`) |

## Key Directories

```
src/
├── app/              # Next.js pages
├── components/       # Shared UI components
├── hooks/            # useLoadContract, useLocalAbis
├── networks/         # Chain configurations
├── utils/            # deploymentMode detection
└── store/            # Redux store and feature modules
scripts/
├── bundle-local-abis.js  # Build-time ABI bundler
└── watch-abis.js         # Watch mode for auto-rebuild
bin/
└── cli.js            # CLI with bundling/watch integration
public/
└── local-abis.json   # Bundled ABIs (gitignored, generated)
```

## Path Alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`)

## IPFS Deployment

To deploy to IPFS:

1. Run `npm run export` to build static files
2. Upload `out/` directory to IPFS: `ipfs add -r out/`
3. Access via any IPFS gateway

The app automatically detects IPFS deployment mode and adjusts UI accordingly (hides local ABI options when not available).
