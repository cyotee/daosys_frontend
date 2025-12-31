# Plan: DaoSYS Frontend Improvements

## Overview

This plan covers quality improvements for the DaoSYS Frontend to make it production-ready and maintainable.

## Summary

| # | Improvement | Priority | Effort | Status |
|---|-------------|----------|--------|--------|
| 1 | Add tests for hooks and utilities | High | Medium | **COMPLETED** |
| 2 | Fix TypeScript types in useLoadContract | High | Low | **COMPLETED** |
| 3 | Add error notifications | Medium | Low | Pending |
| 4 | Add loading skeletons | Low | Low | Pending |
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

## 3. Add Error Notifications

**Priority**: Medium
**Effort**: Low
**Status**: Pending

### Current Problem

Errors are logged to console but users don't see them:
```typescript
} catch (e) {
    console.log(e);
    setLoadingState('metadata-not-found');
}
```

### Solution

Add a toast/snackbar notification system using MUI.

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/Notifications/NotificationProvider.tsx` | CREATE - Context for notifications |
| `src/components/Notifications/useNotification.ts` | CREATE - Hook to show notifications |
| `src/app/providers.tsx` | MODIFY - Wrap with NotificationProvider |
| `src/hooks/useLoadContract.ts` | MODIFY - Show error notifications |
| `src/app/connectContract/page.tsx` | MODIFY - Show error notifications |

### Implementation

```typescript
// useNotification.ts
export function useNotification() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<'error' | 'warning' | 'info' | 'success'>('info');

  const notify = (msg: string, sev: typeof severity = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  };

  return { notify, notifyError: (msg) => notify(msg, 'error'), ... };
}
```

---

## 4. Add Loading Skeletons

**Priority**: Low
**Effort**: Low
**Status**: Pending

### Files to Modify

| File | Changes |
|------|---------|
| `src/app/page.tsx` | Add skeleton while tabs load |
| `src/app/collections/page.tsx` | Add skeleton while collections load |
| `src/app/connectContract/page.tsx` | Already has loading state (good) |

### Implementation

```typescript
import { Skeleton } from '@mui/material';

// In component
if (loading) {
  return (
    <Box>
      <Skeleton variant="rectangular" height={200} />
      <Skeleton variant="text" sx={{ mt: 2 }} />
      <Skeleton variant="text" />
    </Box>
  );
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
3. **Add error notifications** - Better UX (next priority)
4. **Add loading skeletons** - Polish
5. **Proxy detection** - Feature from POC
6. **IPFS export/import** - Feature from POC
7. **Dependency updates** - Only when necessary (create separate branch)
