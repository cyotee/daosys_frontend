import { detectProxy, getProxyTypeLabel, ProxyType, ProxyInfo } from '../proxyDetection';
import type { PublicClient, Address } from 'viem';

// EIP-1967 storage slots
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const EIP1822_LOGIC_SLOT = '0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7';

const ZERO_SLOT = '0x' + '0'.repeat(64);
const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' as Address;
const IMPL_ADDRESS = '0xabcdef1234567890abcdef1234567890abcdef12' as Address;
const BEACON_ADDRESS = '0xbeac0n1234567890beac0n1234567890beac0n12' as Address;
const ADMIN_ADDRESS = '0xad1234567890ad1234567890ad1234567890ad12' as Address;

// Pad address to 32 bytes (64 hex chars)
const padAddress = (address: string): string => {
  return '0x' + address.slice(2).padStart(64, '0');
};

describe('proxyDetection', () => {
  describe('detectProxy', () => {
    const createMockClient = (storageMap: Record<string, string>, readContractResult?: Address) => {
      return {
        getStorageAt: jest.fn().mockImplementation(({ address, slot }) => {
          return Promise.resolve(storageMap[slot] || ZERO_SLOT);
        }),
        readContract: jest.fn().mockImplementation(() => {
          if (readContractResult) {
            return Promise.resolve(readContractResult);
          }
          throw new Error('readContract not mocked');
        }),
      } as unknown as PublicClient;
    };

    it('should return non-proxy for contract with no proxy slots', async () => {
      const mockClient = createMockClient({});

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(false);
      expect(result.proxyType).toBe('none');
      expect(result.implementationAddress).toBeNull();
    });

    it('should detect EIP-1967 proxy with implementation address', async () => {
      const mockClient = createMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: padAddress(IMPL_ADDRESS),
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1967');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS.toLowerCase());
    });

    it('should detect EIP-1967 proxy with admin address', async () => {
      const mockClient = createMockClient({
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
      const mockClient = createMockClient({
        [EIP1967_BEACON_SLOT]: padAddress(BEACON_ADDRESS),
      }, IMPL_ADDRESS);

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1967-beacon');
      expect(result.beaconAddress).toBe(BEACON_ADDRESS.toLowerCase());
      expect(result.implementationAddress).toBe(IMPL_ADDRESS);
    });

    it('should detect beacon proxy even if implementation call fails', async () => {
      const mockClient = createMockClient({
        [EIP1967_BEACON_SLOT]: padAddress(BEACON_ADDRESS),
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1967-beacon');
      expect(result.beaconAddress).toBe(BEACON_ADDRESS.toLowerCase());
      expect(result.implementationAddress).toBeNull();
    });

    it('should detect EIP-1822 proxy', async () => {
      const mockClient = createMockClient({
        [EIP1822_LOGIC_SLOT]: padAddress(IMPL_ADDRESS),
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1822');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS.toLowerCase());
    });

    it('should prioritize EIP-1967 over EIP-1822 when both are present', async () => {
      const differentImplAddress = '0xdifferent1234567890different1234567890diff';
      const mockClient = createMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: padAddress(IMPL_ADDRESS),
        [EIP1822_LOGIC_SLOT]: padAddress(differentImplAddress),
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(true);
      expect(result.proxyType).toBe('EIP-1967');
      expect(result.implementationAddress).toBe(IMPL_ADDRESS.toLowerCase());
    });

    it('should return non-proxy when all slots are zero', async () => {
      const mockClient = createMockClient({
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
      const mockClient = createMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: '',
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(false);
    });

    it('should handle "0x" from getStorageAt', async () => {
      const mockClient = createMockClient({
        [EIP1967_IMPLEMENTATION_SLOT]: '0x',
      });

      const result = await detectProxy(mockClient, TEST_ADDRESS);

      expect(result.isProxy).toBe(false);
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

    it('should return correct label for none', () => {
      expect(getProxyTypeLabel('none')).toBe('Not a proxy');
    });
  });
});
