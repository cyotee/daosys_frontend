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
| 5 | Implement proxy contract detection | Low | Medium | Pending |
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

## 5. Implement Proxy Contract Detection

**Priority**: Low
**Effort**: Medium
**Status**: Pending

### Background

From `docs/POC.md`:
> 1. Handle proxy contract as base contract to detect IPFS metadata
> 2. Get proxy implementation
> 3. Display implementation interaction UI and proxy interaction UI too

### Implementation

Detect common proxy patterns:
- EIP-1967 (Transparent Proxy)
- EIP-1822 (UUPS)
- EIP-897 (Delegate Proxy)

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/utils/proxyDetection.ts` | CREATE - Detect proxy type, get implementation |
| `src/hooks/useLoadContract.ts` | MODIFY - Check for proxy, load both ABIs |
| `src/app/connectContract/page.tsx` | MODIFY - Show proxy info, option to load implementation |

### Implementation

```typescript
// proxyDetection.ts
import { PublicClient, Address } from 'viem';

// EIP-1967 storage slots
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

export async function detectProxy(client: PublicClient, address: Address) {
  // Read implementation slot
  const impl = await client.getStorageAt({ address, slot: IMPLEMENTATION_SLOT });
  if (impl && impl !== '0x' + '0'.repeat(64)) {
    return {
      isProxy: true,
      type: 'EIP-1967',
      implementation: '0x' + impl.slice(-40) as Address
    };
  }
  return { isProxy: false };
}
```

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
5. **Proxy detection** - Feature from POC (next priority)
6. **IPFS export/import** - Feature from POC
7. **Dependency updates** - Only when necessary (create separate branch)
