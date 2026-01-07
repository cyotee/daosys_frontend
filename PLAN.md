# DaoSYS Frontend: wagmi migration plan

This file is the “handoff doc” for continuing the wallet stack migration.

## Current status (as of 2026-01-07)

- Repo: `daosys_frontend` (this folder)
- Branch: `main`
- Latest commit: `aa83b90` ("fix(frontend): update wagmi/viem + build fixes")
- Verified commands:
  - `npm run build` ✅
  - `npm test` ✅ (135 tests)

## What was done

Goal was to modernize the app enough to build cleanly and keep RainbowKit compatibility.

- Upgraded wallet stack to a working set:
  - `wagmi` pinned to `^2.9.0` (RainbowKit 2.2.10 peer requirement)
  - `viem` bumped to `^2.0.0`
  - `@rainbow-me/rainbowkit` pinned to `2.2.10`
  - Added `@tanstack/react-query` and wrapped app with `QueryClientProvider`

- Fixed Next build blockers and TS strictness issues (not exhaustive):
  - Guarded `usePublicClient()` returning possibly undefined in a few places.
  - Updated viem contract instantiation to v2 API: `getContract({ client })`.
  - Adjusted custom chain typing (`rollux`) to `viem/chains` `Chain` type.
  - Updated transaction receipt hook usage and event decoding typing.
  - Added a webpack alias stub for a MetaMask SDK dependency to avoid bundling failure.

## Key files touched (high signal)

- `src/app/providers.tsx`
  - Wagmi config + `QueryClientProvider` + `RainbowKitProvider` integration.
  - Uses injected connector only (no WalletConnect projectId required).

- `src/hooks/useLoadContract.ts`
  - viem v2 `getContract` signature updated.

- `src/app/connectContract/page.tsx`
  - Additional null-guards around public client chainId.

## Why we are not on wagmi v3 yet

RainbowKit is the blocker.

- `@rainbow-me/rainbowkit@2.2.10` peers `wagmi` at `^2.9.0`.
- To use wagmi v3, we must remove/replace RainbowKit (or find a RainbowKit release that supports wagmi v3).

## Remaining work: switch to wagmi v3 (remove RainbowKit)

This is the recommended sequence to avoid thrash.

### Phase 1 — branch + dependency bump

1. Create a branch off current `main`.
   - Suggested: `feat/wagmi-v3-no-rainbowkit`

2. Remove RainbowKit from dependencies.
   - Remove `@rainbow-me/rainbowkit` from `package.json`.
   - Remove any RainbowKit CSS import (if present).

3. Upgrade wagmi.
   - Set `wagmi` to `^3.x`.
   - Align `viem` version to what wagmi v3 expects.
   - Keep `@tanstack/react-query` (wagmi uses it).

Validation gate: `npm test` and `npm run build`.

### Phase 2 — replace RainbowKit UI with minimal in-app wallet UX

RainbowKit provided wallet UX (connect button/modals/recent tx UI). When removed:

1. Create a minimal wallet component (MUI-based) that:
   - Lists available connectors (`useConnect()`)
   - Connects/disconnects (`useConnect()`, `useDisconnect()`)
   - Displays address + status (`useAccount()`)
   - Optionally switches chains (`useSwitchChain()`)

2. Replace any RainbowKit component usage if it exists in the current app.
   - Look for: `ConnectButton`, `useConnectModal`, `useAccountModal`, `useChainModal`.
   - In this codebase, RainbowKit usage is currently centralized in providers; still do a search when doing the actual branch work.

Validation gate: manual smoke test in `npm run dev`.

### Phase 3 — wagmi v2 → v3 API updates

When bumping to wagmi v3, expect these categories of changes:

- Provider layer changes:
  - `WagmiConfig` replaced by wagmi v3 provider API.
  - config creation may require small updates depending on the chosen connectors/transports.

- Hook/API changes:
  - Some hook names/signatures changed between v2 and v3.
  - `usePublicClient()` and friends remain but may have stricter typing.

- Connector changes:
  - If using WalletConnect in v3, it will require a projectId and a proper connector setup.
  - If staying injected-only (MetaMask/etc.), it can remain minimal.

Validation gate: `npm run build` must succeed without prerender errors.

## Context for the next agent/session

If you’re resuming this task later, capture/confirm:

- The starting commit is `aa83b90`.
- Confirm current working commands:
  - `npm run build`
  - `npm test`
- The migration goal is wagmi v3, and it implies removing RainbowKit unless RainbowKit supports wagmi v3.
- Decide upfront whether WalletConnect is required; if yes, you’ll need a `projectId` strategy and connector UX.

**Priority**: Low
**Effort**: Medium
**Status**: Completed

### Background

From `docs/POC.md`:
> 1. Handle proxy contract as base contract to detect IPFS metadata
> 2. Get proxy implementation
> 3. Display implementation interaction UI and proxy interaction UI too

### Files Created

| File | Purpose |
|------|---------|
| `src/utils/proxyDetection.ts` | Core proxy detection logic |
| `src/hooks/useProxyDetection.ts` | React hook for proxy detection |
| `src/utils/__tests__/proxyDetection.test.ts` | 15 tests for detection logic |
| `src/hooks/__tests__/useProxyDetection.test.ts` | 10 tests for the hook |

### Files Modified

| File | Changes |
|------|---------|
| `src/app/connectContract/page.tsx` | Integrated proxy detection UI |
| `jest.setup.js` | Added TextEncoder/TextDecoder for viem |

### Proxy Types Detected

| Type | Detection Method | Description |
|------|------------------|-------------|
| **EIP-1967** | Storage slot | Transparent Proxy / UUPS (OpenZeppelin) |
| **EIP-1967-beacon** | Storage slot + function call | Beacon Proxy - retrieves implementation from beacon |
| **EIP-1822** | Storage slot | UUPS (older standard) |
| **EIP-897** | Function call + bytecode check | Delegate Proxy via `implementation()` |
| **GnosisSafe** | Function call or slot 0 | Gnosis Safe Proxy via `masterCopy()` or slot 0 |
| **ERC-8109** | Function call | Diamond Proxy (Simplified) via `functionFacetPairs()` |
| **EIP-2535** | Function call | Diamond Proxy (Original) via `facetAddresses()` or `facets()` |
| **Compound** | Function call | Compound-style via `comptrollerImplementation()` |

### Features Implemented

- Automatic proxy detection when valid address is entered
- Displays proxy type, implementation address, beacon address (if applicable), admin address
- Diamond proxies (ERC-8109 and EIP-2535): displays all facet addresses in scrollable list
- "Load Implementation Contract" button to switch to implementation address (non-Diamond proxies)
- Non-proxy contracts show success message
- Detection state indicator (detecting/detected/error)

### Test Results

- `proxyDetection.test.ts`: 27 tests
- `useProxyDetection.test.ts`: 11 tests
- **Total new tests**: 38 tests (135 total across all suites)

---

## 6. Implement IPFS Collection Export/Import

**Priority**: Low
**Effort**: Medium
**Status**: Pending

### Background

From `docs/POC.md`:
> Export can be performed by:
> - print out JSON and able user to download it
> - store to IPFS and PIN it then user will get IPFS hash

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/utils/ipfsExport.ts` | CREATE - Upload to IPFS via public gateway |
| `src/store/features/collections/components/ExportModal.tsx` | CREATE - Export UI |
| `src/store/features/collections/components/ImportModal.tsx` | CREATE - Import UI |
| `src/app/collections/page.tsx` | MODIFY - Add export/import buttons |

---

## 7. Update Dependencies (Future)

**Priority**: Low (defer until needed)
**Effort**: Medium
**Status**: Pending - Create separate branch when ready

### Not Recommended Now

Wagmi 2.x migration requires:
- TanStack Query as new peer dependency
- RainbowKit 2.x (coupled upgrade)
- Config API changes
- Hook return type changes

**Wait until**: Security issue, needed feature, or major refactor.

---

## Next Steps

1. ~~**Fix TypeScript types**~~ - DONE
2. ~~**Add tests**~~ - DONE (93 tests passing)
3. ~~**Add error notifications**~~ - DONE (toast notifications with MUI Snackbar)
4. ~~**Add loading skeletons**~~ - DONE (SSR hydration handling)
5. ~~**Proxy detection**~~ - DONE (118 tests passing, EIP-1967/1822/beacon detection)
6. **IPFS export/import** - Feature from POC (next priority)
7. **Dependency updates** - Only when necessary (create separate branch)
