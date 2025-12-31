# Plan: DaoSYS Frontend Improvements

## Overview

This plan covers quality improvements for the DaoSYS Frontend to make it production-ready and maintainable.

## Summary

| # | Improvement | Priority | Effort | Status |
|---|-------------|----------|--------|--------|
| 1 | Add tests for hooks and utilities | High | Medium | **COMPLETED** |
| 2 | Fix TypeScript types in useLoadContract | High | Low | **COMPLETED** |
| 3 | Add error notifications | Medium | Low | **COMPLETED** |
| 4 | Add loading skeletons | Low | Low | **COMPLETED** |
| 5 | Implement proxy contract detection | Low | Medium | **COMPLETED** |
| 6 | Implement IPFS collection export/import | Low | Medium | Pending |
| 7 | Update dependencies (Wagmi 2.x) | Low | Medium | Pending |

---

## 1. Add Tests for Hooks and Utilities - COMPLETED

**Priority**: High
**Effort**: Medium
**Status**: Completed

### Files Created

| File | Tests | Coverage |
|------|-------|----------|
| `src/utils/__tests__/deploymentMode.test.ts` | 30 tests | 82.5% statements, 80% branches |
| `src/hooks/__tests__/useLocalAbis.test.ts` | 17 tests | 92.1% statements, 97.4% branches |
| `src/hooks/__tests__/useLoadContract.test.ts` | 15 tests | 100% statements, 90.3% branches |
| `scripts/__tests__/bundle-local-abis.test.js` | 31 tests | 66.2% statements, 60.2% branches |
| `jest.config.js` | - | Jest configuration with TypeScript support |
| `jest.setup.js` | - | Test setup with mocks for wagmi, fetch, localStorage |

### Dependencies Added

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom ts-jest @types/jest
```

### Test Results

**Total: 93 tests passing**

### Coverage Thresholds Configured

```javascript
coverageThreshold: {
  './src/utils/deploymentMode.ts': { branches: 70, functions: 80, lines: 70, statements: 70 },
  './src/hooks/useLocalAbis.ts': { branches: 50, functions: 50, lines: 50, statements: 50 },
  './scripts/bundle-local-abis.js': { branches: 40, functions: 60, lines: 50, statements: 50 },
}
```

### Refactoring for Testability

- `deploymentMode.ts`: Added optional `LocationLike` parameter for testing without mocking `window.location`
- `bundle-local-abis.js`: Exported functions for unit testing
- `useLocalAbis.ts`: Fixed bug where errors weren't properly propagated to hook state

---

## 2. Fix TypeScript Types in useLoadContract - COMPLETED

**Priority**: High
**Effort**: Low
**Status**: Completed

### Changes Made

```typescript
// Before: @ts-ignore comments throughout
const contract = getContract({
    //@ts-ignore
    address: contractAddress,
    //@ts-ignore
    abi: manualAbi,
    //@ts-ignore
    walletClient: wallet,
});

// After: Proper types from viem
import { isAddress, getContract, type Abi, type Address } from "viem";

type ContractInstance = {
    address: Address;
    abi: Abi;
    read?: Record<string, unknown>;
    write?: Record<string, unknown>;
    simulate?: Record<string, unknown>;
};

const loadContract = useCallback(async (addressToLoad: string, abi: Abi) => {
    const contractInstance = getContract({
        address: addressToLoad as Address,
        abi: abi,
        walletClient: wallet.data ?? undefined,
        publicClient: client,
    });
    // ...
}, [wallet.data, client]);
```

### Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useLoadContract.ts` | Removed all `@ts-ignore`, added proper types from viem |

---

## 3. Add Error Notifications - COMPLETED

**Priority**: Medium
**Effort**: Low
**Status**: Completed

### Files Created

| File | Purpose |
|------|---------|
| `src/components/Notifications/NotificationContext.tsx` | Context provider with Snackbar/Alert UI |
| `src/components/Notifications/index.ts` | Export barrel file |

### Files Modified

| File | Changes |
|------|---------|
| `src/app/providers.tsx` | Wrapped app with NotificationProvider |
| `src/app/connectContract/page.tsx` | Added notifications for all loading states |

### Features Implemented

- **Success notifications**: Contract loaded successfully
- **Error notifications**: Failed to load contract, invalid ABI JSON
- **Warning notifications**: Metadata not found (prompts manual ABI entry)
- **Auto-hide**: 6 seconds for info/success/warning, 10 seconds for errors
- **Queue system**: Notifications display one at a time

### Usage

```typescript
import { useNotification } from '@/components/Notifications';

const { notifySuccess, notifyError, notifyWarning, notifyInfo } = useNotification();

notifySuccess('Contract loaded!');
notifyError('Failed to load contract');
notifyWarning('Metadata not found');
```

---

## 4. Add Loading Skeletons - COMPLETED

**Priority**: Low
**Effort**: Low
**Status**: Completed

### Files Created

| File | Purpose |
|------|---------|
| `src/components/Skeletons/PageSkeleton.tsx` | Reusable skeleton components |
| `src/components/Skeletons/index.ts` | Export barrel file |

### Files Modified

| File | Changes |
|------|---------|
| `src/app/page.tsx` | Added `TabsSkeleton` during SSR hydration |
| `src/app/collections/page.tsx` | Added `CollectionsSkeleton` during SSR hydration |
| `src/app/connectContract/page.tsx` | Already has loading state (no changes needed) |

### Skeleton Components

- **TabsSkeleton**: Mimics tab bar and content area
- **CollectionsSkeleton**: Mimics header and table rows
- **ContractFormSkeleton**: Mimics form fields (available for future use)

### Implementation Pattern

```typescript
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true);
}, []);

if (!mounted) {
  return <TabsSkeleton />;
}
```

---

## 5. Implement Proxy Contract Detection - COMPLETED

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
