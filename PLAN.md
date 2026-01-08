# DaoSYS Frontend: Wallet Stack Migration (wagmi v3)

This section is the “handoff doc” for the wallet stack migration.

## Current status (as of 2026-01-08)

- Repo: `daosys_frontend` (this folder)
- Branch: `main` (local working tree currently has uncommitted changes)
- Base commit: `0c3d84a`
- Verified commands:
  - `npm test` ✅ (135 tests)
  - `npm run build` ✅

## What is done

- Migrated to wagmi v3 (and aligned deps):
  - `wagmi`: `^3.0.0`
  - `viem`: `^2.0.0`
  - `@tanstack/react-query`: `^5.0.0`
  - TypeScript bumped to `^5.7.3` (wagmi v3 recommended minimum)

- Removed RainbowKit entirely:
  - Removed `@rainbow-me/rainbowkit` dependency
  - Removed RainbowKit CSS import
  - Replaced `<ConnectButton />` with a minimal connect/disconnect button using wagmi hooks

- Updated provider wiring for wagmi v3:
  - `WagmiConfig` → `WagmiProvider`
  - `createConfig({ transports })` with `viem` `http(...)`

## Files currently changed (not committed yet)

- `package.json`
- `package-lock.json` (now synced to wagmi v3 / viem v2)
- `src/app/layout.tsx`
- `src/app/providers.tsx`
- `src/components/Wrapper.tsx`

## Notes (wagmi v2 → v3)

- wagmi v3 makes connector dependencies optional peer deps.
  - This app uses the injected connector only (`injected()`), so no extra connector packages are required.

## Remaining work

- Decide whether we need WalletConnect (requires a projectId + connector dependency) or injected-only is sufficient.
- If this work is ready, commit the above changed files.

---

# Proxy detection / POC work

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
