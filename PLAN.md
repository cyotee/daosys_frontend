# Plan: DaoSYS Frontend Improvements

## Overview

This plan covers quality improvements for the DaoSYS Frontend to make it production-ready and maintainable.

## Summary

| # | Improvement | Priority | Effort |
|---|-------------|----------|--------|
| 1 | Add tests for hooks and utilities | High | Medium |
| 2 | Fix TypeScript types in useLoadContract | High | Low |
| 3 | Add error notifications | Medium | Low |
| 4 | Add loading skeletons | Low | Low |
| 5 | Implement proxy contract detection | Low | Medium |
| 6 | Implement IPFS collection export/import | Low | Medium |
| 7 | Update dependencies (Wagmi 2.x) | Low | Medium |

---

## 1. Add Tests for Hooks and Utilities

**Priority**: High
**Effort**: Medium

### Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/__tests__/useLocalAbis.test.ts` | Test static manifest loading, caching, error handling |
| `src/hooks/__tests__/useLoadContract.test.ts` | Test contract loading flow, fallbacks |
| `src/utils/__tests__/deploymentMode.test.ts` | Test IPFS gateway detection, mode detection |
| `scripts/__tests__/bundle-local-abis.test.js` | Test Foundry/Hardhat artifact scanning |
| `jest.config.js` | Jest configuration |
| `jest.setup.js` | Test setup (mocks for wagmi, fetch, etc.) |

### Dependencies to Add

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

### Test Cases

**useLocalAbis.ts**:
- Returns empty when manifest doesn't exist
- Parses valid manifest correctly
- Caches manifest after first load
- `invalidateManifestCache()` clears cache

**useLoadContract.ts**:
- Validates address format
- Falls back to manual ABI when metadata not found
- Stores contract in Redux on success

**deploymentMode.ts**:
- Detects localhost as 'local'
- Detects IPFS gateways correctly (ipfs.io, dweb.link, etc.)
- Detects ipfs:// protocol

---

## 2. Fix TypeScript Types in useLoadContract

**Priority**: High
**Effort**: Low

### Current Issues

```typescript
// src/hooks/useLoadContract.ts - lines 75-85
const contract = getContract({
    //@ts-ignore
    address: contractAddress,
    //@ts-ignore
    abi: manualAbi,
    //@ts-ignore
    walletClient: wallet,
});
```

### Solution

```typescript
import { Abi, Address } from 'viem';

const loadContract = useCallback(async (
  contractAddress: Address,
  manualAbi: Abi
) => {
  const contract = getContract({
    address: contractAddress as Address,
    abi: manualAbi,
    client: { wallet: wallet.data, public: client }
  });
  // ...
}, [wallet, client]);
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useLoadContract.ts` | Add proper types, remove @ts-ignore |

---

## 3. Add Error Notifications

**Priority**: Medium
**Effort**: Low

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

### Not Recommended Now

Wagmi 2.x migration requires:
- TanStack Query as new peer dependency
- RainbowKit 2.x (coupled upgrade)
- Config API changes
- Hook return type changes

**Wait until**: Security issue, needed feature, or major refactor.

---

## Implementation Order

1. **Fix TypeScript types** - Quick win, improves code quality
2. **Add tests** - Foundation for safe refactoring
3. **Add error notifications** - Better UX
4. **Add loading skeletons** - Polish
5. **Proxy detection** - Feature from POC
6. **IPFS export/import** - Feature from POC
7. **Dependency updates** - Only when necessary
