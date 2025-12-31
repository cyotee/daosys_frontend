import { detectProxy, getProxyTypeLabel, ProxyType, ProxyInfo } from '../proxyDetection';
import type { PublicClient, Address } from 'viem';

// EIP-1967 storage slots
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const EIP1822_LOGIC_SLOT = '0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7';
const GNOSIS_SAFE_SLOT = '0x0000000000000000000000000000000000000000000000000000000000000000';

const ZERO_SLOT = '0x' + '0'.repeat(64);
const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' as Address;
const IMPL_ADDRESS = '0xabcdef1234567890abcdef1234567890abcdef12' as Address;
const BEACON_ADDRESS = '0xbeac0n1234567890beac0n1234567890beac0n12' as Address;
const ADMIN_ADDRESS = '0xad1234567890ad1234567890ad1234567890ad12' as Address;
const FACET_ADDRESS_1 = '0xfacet11234567890facet11234567890facet112' as Address;
const FACET_ADDRESS_2 = '0xfacet21234567890facet21234567890facet212' as Address;

// Pad address to 32 bytes (64 hex chars)
const padAddress = (address: string): string => {
  return '0x' + address.slice(2).padStart(64, '0');
};

describe('proxyDetection', () => {
  describe('detectProxy', () => {
    // Helper to create mock client with customizable behavior
    const createMockClient = (
      storageMap: Record<string, string>,
      readContractMock?: (args: { functionName: string }) => any
    ) => {
      return {
        getStorageAt: jest.fn().mockImplementation(({ slot }) => {
          return Promise.resolve(storageMap[slot] || ZERO_SLOT);
        }),
        readContract: jest.fn().mockImplementation((args: { functionName: string }) => {
          if (readContractMock) {
            return readContractMock(args);
          }
          throw new Error('readContract not mocked');
        }),
        getBytecode: jest.fn().mockResolvedValue('0x6080604052'),
      } as unknown as PublicClient;
    };

    // Simple mock for basic storage-only tests
    const createSimpleMockClient = (storageMap: Record<string, string>, readContractResult?: Address) => {
      return {
        getStorageAt: jest.fn().mockImplementation(({ slot }) => {
          return Promise.resolve(storageMap[slot] || ZERO_SLOT);
        }),
        readContract: jest.fn().mockImplementation(() => {
          if (readContractResult) {
            return Promise.resolve(readContractResult);
          }
          throw new Error('readContract not mocked');
        }),
        getBytecode: jest.fn().mockResolvedValue('0x6080604052'),
      } as unknown as PublicClient;
    };

    it('should return non-proxy for contract with no proxy slots', async () => {
      const mockClient = createSimpleMockClient({});

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(false);
      expect(result.proxyType).toBe('none');
      expect(result.implementationAddress).toBeNull();
    });

    it('should detect EIP-1967 proxy with implementation address', async () => {
      const mockClient = createSimpleMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: padAddress(IMPL_ADDRESS),
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1967');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS.toLowerCase());
    });

    it('should detect EIP-1967 proxy with admin address', async () => {
      const mockClient = createSimpleMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: padAddress(IMPL_ADDRESS),
        [EIP1967_ADMIN_SLOT]: padAddress(ADMIN_ADDRESS),
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1967');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS.toLowerCase());
      expect(result.adminAddress).toBe(ADMIN_ADDRESS.toLowerCase());
    });

    it('should detect EIP-1967 beacon proxy', async () => {
      const mockClient = createSimpleMockClient({
        [EIP1967_BEACON_SLOT]: padAddress(BEACON_ADDRESS),
      }, IMPL_ADDRESS);

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1967-beacon');
      expect(result.beaconAddress).toBe(BEACON_ADDRESS.toLowerCase());
      expect(result.implementationAddress).toBe(IMPL_ADDRESS);
    });

    it('should detect beacon proxy even if implementation call fails', async () => {
      const mockClient = createSimpleMockClient({
        [EIP1967_BEACON_SLOT]: padAddress(BEACON_ADDRESS),
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1967-beacon');
      expect(result.beaconAddress).toBe(BEACON_ADDRESS.toLowerCase());
      expect(result.implementationAddress).toBeNull();
    });

    it('should detect EIP-1822 proxy', async () => {
      const mockClient = createSimpleMockClient({
        [EIP1822_LOGIC_SLOT]: padAddress(IMPL_ADDRESS),
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1822');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS.toLowerCase());
    });

    it('should prioritize EIP-1967 over EIP-1822 when both are present', async () => {
      const differentImplAddress = '0xdifferent1234567890different1234567890diff';
      const mockClient = createSimpleMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: padAddress(IMPL_ADDRESS),
        [EIP1822_LOGIC_SLOT]: padAddress(differentImplAddress),
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1967');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS.toLowerCase());
    });

    it('should return non-proxy when all slots are zero', async () => {
      const mockClient = createSimpleMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: ZERO_SLOT,
        [EIP1967_BEACON_SLOT]: ZERO_SLOT,
        [EIP1822_LOGIC_SLOT]: ZERO_SLOT,
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(false);
      expect(result.proxyType).toBe('none');
    });

    it('should handle getStorageAt errors gracefully', async () => {
      const mockClient = {
        getStorageAt: jest.fn().mockRejectedValue(new Error('RPC error')),
      } as unknown as PublicClient;

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(false);
      expect(result.proxyType).toBe('none');
    });

    it('should handle empty string from getStorageAt', async () => {
      const mockClient = createSimpleMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: '',
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(false);
    });

    it('should handle "0x" from getStorageAt', async () => {
      const mockClient = createSimpleMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: '0x',
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(false);
    });

    // New proxy type tests

    it('should detect ERC-8109 Diamond proxy via functionFacetPairs()', async () => {
      const mockClient = createMockClient({}, ({ functionName }) => {
        if (functionName === 'functionFacetPairs') {
          return Promise.resolve([
            { functionSelector: '0x12345678', facetAddress: FACET_ADDRESS_1 },
            { functionSelector: '0xabcdef12', facetAddress: FACET_ADDRESS_1 },
            { functionSelector: '0x87654321', facetAddress: FACET_ADDRESS_2 },
          ]);
        }
        throw new Error('Not mocked');
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('ERC-8109');
      // Should have unique facet addresses (2, not 3)
      expect(result.facetAddresses).toHaveLength(2);
      expect(result.facetAddresses).toContain(FACET_ADDRESS_1);
      expect(result.facetAddresses).toContain(FACET_ADDRESS_2);
      expect(result.implementationAddress).toBe(FACET_ADDRESS_1);
    });

    it('should prioritize ERC-8109 over EIP-2535 when both are present', async () => {
      const mockClient = createMockClient({}, ({ functionName }) => {
        // Both functionFacetPairs (ERC-8109) and facetAddresses (EIP-2535) exist
        if (functionName === 'functionFacetPairs') {
          return Promise.resolve([
            { functionSelector: '0x12345678', facetAddress: FACET_ADDRESS_1 },
          ]);
        }
        if (functionName === 'facetAddresses') {
          return Promise.resolve([FACET_ADDRESS_2]);
        }
        throw new Error('Not mocked');
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('ERC-8109'); // ERC-8109 should be detected first
      expect(result.facetAddresses).toContain(FACET_ADDRESS_1);
    });

    it('should fall back to EIP-2535 when ERC-8109 is not supported', async () => {
      const mockClient = createMockClient({}, ({ functionName }) => {
        // functionFacetPairs fails (not ERC-8109), but facetAddresses works (EIP-2535)
        if (functionName === 'functionFacetPairs') {
          throw new Error('Not implemented');
        }
        if (functionName === 'facetAddresses') {
          return Promise.resolve([FACET_ADDRESS_1, FACET_ADDRESS_2]);
        }
        throw new Error('Not mocked');
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-2535');
      expect(result.facetAddresses).toEqual([FACET_ADDRESS_1, FACET_ADDRESS_2]);
    });

    it('should detect EIP-2535 Diamond proxy via facetAddresses()', async () => {
      const mockClient = createMockClient({}, ({ functionName }) => {
        if (functionName === 'facetAddresses') {
          return Promise.resolve([FACET_ADDRESS_1, FACET_ADDRESS_2]);
        }
        throw new Error('Not mocked');
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-2535');
      expect(result.facetAddresses).toEqual([FACET_ADDRESS_1, FACET_ADDRESS_2]);
      expect(result.implementationAddress).toBe(FACET_ADDRESS_1);
    });

    it('should detect EIP-2535 Diamond proxy via facets()', async () => {
      const mockClient = createMockClient({}, ({ functionName }) => {
        if (functionName === 'facets') {
          return Promise.resolve([
            { facetAddress: FACET_ADDRESS_1, functionSelectors: ['0x12345678'] },
            { facetAddress: FACET_ADDRESS_2, functionSelectors: ['0xabcdef12'] },
          ]);
        }
        throw new Error('Not mocked');
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-2535');
      expect(result.facetAddresses).toEqual([FACET_ADDRESS_1, FACET_ADDRESS_2]);
    });

    it('should detect GnosisSafe proxy via masterCopy()', async () => {
      const mockClient = createMockClient({}, ({ functionName }) => {
        if (functionName === 'masterCopy') {
          return Promise.resolve(IMPL_ADDRESS);
        }
        throw new Error('Not mocked');
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('GnosisSafe');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS);
    });

    it('should detect GnosisSafe proxy via slot 0 with getThreshold', async () => {
      const mockClient = createMockClient(
        { [GNOSIS_SAFE_SLOT]: padAddress(IMPL_ADDRESS) },
        ({ functionName }) => {
          if (functionName === 'getThreshold') {
            return Promise.resolve(BigInt(2));
          }
          throw new Error('Not mocked');
        }
      );

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('GnosisSafe');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS.toLowerCase());
    });

    it('should detect Compound proxy via comptrollerImplementation()', async () => {
      const mockClient = createMockClient({}, ({ functionName }) => {
        if (functionName === 'comptrollerImplementation') {
          return Promise.resolve(IMPL_ADDRESS);
        }
        throw new Error('Not mocked');
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('Compound');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS);
    });

    it('should detect Compound proxy via implementation() + admin()', async () => {
      const mockClient = createMockClient({}, ({ functionName }) => {
        if (functionName === 'implementation') {
          return Promise.resolve(IMPL_ADDRESS);
        }
        if (functionName === 'admin') {
          return Promise.resolve(ADMIN_ADDRESS);
        }
        throw new Error('Not mocked');
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('Compound');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS);
    });

    it('should detect EIP-897 proxy via implementation() with bytecode verification', async () => {
      // Create a mock that returns empty for all storage slots but has implementation() function
      const mockClient = {
        getStorageAt: jest.fn().mockResolvedValue(ZERO_SLOT),
        readContract: jest.fn().mockImplementation(({ functionName }) => {
          if (functionName === 'implementation') {
            return Promise.resolve(IMPL_ADDRESS);
          }
          throw new Error('Not mocked');
        }),
        getBytecode: jest.fn().mockResolvedValue('0x6080604052'),
      } as unknown as PublicClient;

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-897');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS);
    });

    it('should include facetAddresses as null for non-Diamond proxies', async () => {
      const mockClient = createSimpleMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: padAddress(IMPL_ADDRESS),
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.facetAddresses).toBeNull();
    });
  });

  describe('getProxyTypeLabel', () => {
    it('should return correct label for EIP-1967', () => {
      expect(getProxyTypeLabel('EIP-1967')).toBe('Transparent/UUPS Proxy (EIP-1967)');
    });

    it('should return correct label for EIP-1967-beacon', () => {
      expect(getProxyTypeLabel('EIP-1967-beacon')).toBe('Beacon Proxy (EIP-1967)');
    });

    it('should return correct label for EIP-1822', () => {
      expect(getProxyTypeLabel('EIP-1822')).toBe('UUPS Proxy (EIP-1822)');
    });

    it('should return correct label for EIP-897', () => {
      expect(getProxyTypeLabel('EIP-897')).toBe('Delegate Proxy (EIP-897)');
    });

    it('should return correct label for GnosisSafe', () => {
      expect(getProxyTypeLabel('GnosisSafe')).toBe('Gnosis Safe Proxy');
    });

    it('should return correct label for ERC-8109', () => {
      expect(getProxyTypeLabel('ERC-8109')).toBe('Diamond Proxy (ERC-8109 Simplified)');
    });

    it('should return correct label for EIP-2535', () => {
      expect(getProxyTypeLabel('EIP-2535')).toBe('Diamond Proxy (EIP-2535)');
    });

    it('should return correct label for Compound', () => {
      expect(getProxyTypeLabel('Compound')).toBe('Compound-style Proxy');
    });

    it('should return correct label for none', () => {
      expect(getProxyTypeLabel('none')).toBe('Not a proxy');
    });
  });
});
