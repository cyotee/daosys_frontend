'use client';

import type { PublicClient, Address } from 'viem';

export type ProxyType =
  | 'EIP-1967'      // Transparent Proxy / UUPS (OpenZeppelin)
  | 'EIP-1967-beacon' // Beacon Proxy
  | 'EIP-1822'      // UUPS (older standard)
  | 'none';

export interface ProxyInfo {
  isProxy: boolean;
  proxyType: ProxyType;
  implementationAddress: Address | null;
  beaconAddress: Address | null;
  adminAddress: Address | null;
}

// EIP-1967 storage slots (keccak256 hash of string - 1)
// https://eips.ethereum.org/EIPS/eip-1967
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

// EIP-1822 storage slot
// https://eips.ethereum.org/EIPS/eip-1822
const EIP1822_LOGIC_SLOT = '0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Extract address from storage slot value (last 20 bytes)
 */
function extractAddressFromSlot(slotValue: string): Address | null {
  if (!slotValue || slotValue === '0x' || slotValue === '0x0') {
    return null;
  }

  // Pad to 66 chars (0x + 64 hex chars) if needed
  const padded = slotValue.padStart(66, '0').replace(/^0+/, '0x');

  // Extract last 40 chars (20 bytes) as address
  const addressHex = '0x' + slotValue.slice(-40);

  // Check if it's zero address
  if (addressHex.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return null;
  }

  return addressHex as Address;
}

/**
 * Detect if a contract is a proxy and get implementation details
 */
export async function detectProxy(
  client: PublicClient,
  address: Address
): Promise<ProxyInfo> {
  const result: ProxyInfo = {
    isProxy: false,
    proxyType: 'none',
    implementationAddress: null,
    beaconAddress: null,
    adminAddress: null,
  };

  try {
    // Check EIP-1967 implementation slot first (most common)
    const eip1967Impl = await client.getStorageAt({
      address,
      slot: EIP1967_IMPLEMENTATION_SLOT as `0x${string}`,
    });

    if (eip1967Impl) {
      const implAddress = extractAddressFromSlot(eip1967Impl);
      if (implAddress) {
        result.isProxy = true;
        result.proxyType = 'EIP-1967';
        result.implementationAddress = implAddress;

        // Also check for admin address
        const adminSlot = await client.getStorageAt({
          address,
          slot: EIP1967_ADMIN_SLOT as `0x${string}`,
        });
        if (adminSlot) {
          result.adminAddress = extractAddressFromSlot(adminSlot);
        }

        return result;
      }
    }

    // Check EIP-1967 beacon slot (Beacon Proxy pattern)
    const beaconSlot = await client.getStorageAt({
      address,
      slot: EIP1967_BEACON_SLOT as `0x${string}`,
    });

    if (beaconSlot) {
      const beaconAddress = extractAddressFromSlot(beaconSlot);
      if (beaconAddress) {
        result.isProxy = true;
        result.proxyType = 'EIP-1967-beacon';
        result.beaconAddress = beaconAddress;

        // Try to get implementation from beacon
        try {
          const implFromBeacon = await client.readContract({
            address: beaconAddress,
            abi: [{
              name: 'implementation',
              type: 'function',
              inputs: [],
              outputs: [{ type: 'address' }],
              stateMutability: 'view',
            }],
            functionName: 'implementation',
          });
          result.implementationAddress = implFromBeacon as Address;
        } catch {
          // Beacon might not have standard implementation() function
        }

        return result;
      }
    }

    // Check EIP-1822 slot (older UUPS)
    const eip1822Slot = await client.getStorageAt({
      address,
      slot: EIP1822_LOGIC_SLOT as `0x${string}`,
    });

    if (eip1822Slot) {
      const implAddress = extractAddressFromSlot(eip1822Slot);
      if (implAddress) {
        result.isProxy = true;
        result.proxyType = 'EIP-1822';
        result.implementationAddress = implAddress;
        return result;
      }
    }

    return result;
  } catch (error) {
    console.error('Error detecting proxy:', error);
    return result;
  }
}

/**
 * Get a human-readable label for the proxy type
 */
export function getProxyTypeLabel(proxyType: ProxyType): string {
  switch (proxyType) {
    case 'EIP-1967':
      return 'Transparent/UUPS Proxy (EIP-1967)';
    case 'EIP-1967-beacon':
      return 'Beacon Proxy (EIP-1967)';
    case 'EIP-1822':
      return 'UUPS Proxy (EIP-1822)';
    default:
      return 'Not a proxy';
  }
}
