'use client';

import { debugError } from './debug';

import type { PublicClient, Address } from 'viem';

export type ProxyType =
  | 'EIP-1967'        // Transparent Proxy / UUPS (OpenZeppelin)
  | 'EIP-1967-beacon' // Beacon Proxy
  | 'EIP-1822'        // UUPS (older standard)
  | 'EIP-897'         // DelegateProxy (function-based)
  | 'GnosisSafe'      // Gnosis Safe Proxy
  | 'ERC-8109'        // Diamond Proxy (Simplified) - check before EIP-2535
  | 'EIP-2535'        // Diamond Proxy (Original)
  | 'Compound'        // Compound-style Proxy
  | 'none';

export interface ProxyInfo {
  isProxy: boolean;
  proxyType: ProxyType;
  implementationAddress: Address | null;
  beaconAddress: Address | null;
  adminAddress: Address | null;
  // Diamond-specific: array of facet addresses
  facetAddresses: Address[] | null;
}

// EIP-1967 storage slots (keccak256 hash of string - 1)
// https://eips.ethereum.org/EIPS/eip-1967
const EIP1967_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const EIP1967_BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const EIP1967_ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';

// EIP-1822 storage slot
// https://eips.ethereum.org/EIPS/eip-1822
const EIP1822_LOGIC_SLOT = '0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7';

// GnosisSafe Proxy - older versions use slot 0, newer use masterCopy slot
// keccak256("masterCopy") - but the actual slot is 0 for GnosisSafe 1.0-1.2
const GNOSIS_SAFE_MASTER_COPY_SLOT = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Compound-style proxy slots
// keccak256("eip1967.proxy.implementation") - but Compound uses different patterns
// Compound Unitroller uses comptrollerImplementation at specific slots
const COMPOUND_IMPLEMENTATION_SLOT = '0x0000000000000000000000000000000000000000000000000000000000000002';

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
    facetAddresses: null,
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

    // Check ERC-8109 Diamond Proxy first (Simplified Diamond - newer standard)
    // ERC-8109 uses functionFacetPairs() instead of facetAddresses()
    const erc8109Result = await detectERC8109Diamond(client, address);
    if (erc8109Result) {
      result.isProxy = true;
      result.proxyType = 'ERC-8109';
      result.facetAddresses = erc8109Result.facets;
      // Diamond proxies don't have a single implementation, but we can set the first facet
      if (erc8109Result.facets.length > 0) {
        result.implementationAddress = erc8109Result.facets[0];
      }
      return result;
    }

    // Check EIP-2535 Diamond Proxy (via facetAddresses() function)
    const diamondResult = await detectDiamondProxy(client, address);
    if (diamondResult) {
      result.isProxy = true;
      result.proxyType = 'EIP-2535';
      result.facetAddresses = diamondResult.facets;
      // Diamond proxies don't have a single implementation, but we can set the first facet
      if (diamondResult.facets.length > 0) {
        result.implementationAddress = diamondResult.facets[0];
      }
      return result;
    }

    // Check GnosisSafe Proxy (slot 0 contains masterCopy)
    const gnosisSafeResult = await detectGnosisSafeProxy(client, address);
    if (gnosisSafeResult) {
      result.isProxy = true;
      result.proxyType = 'GnosisSafe';
      result.implementationAddress = gnosisSafeResult;
      return result;
    }

    // Check Compound-style Proxy (comptrollerImplementation)
    const compoundResult = await detectCompoundProxy(client, address);
    if (compoundResult) {
      result.isProxy = true;
      result.proxyType = 'Compound';
      result.implementationAddress = compoundResult;
      return result;
    }

    // Check EIP-897 DelegateProxy (via implementation() function call)
    // This is checked last as it's the most generic and could false-positive
    const eip897Result = await detectEIP897Proxy(client, address);
    if (eip897Result) {
      result.isProxy = true;
      result.proxyType = 'EIP-897';
      result.implementationAddress = eip897Result;
      return result;
    }

    return result;
  } catch (error) {
    debugError('Error detecting proxy:', error);
    return result;
  }
}

/**
 * Detect EIP-897 DelegateProxy via implementation() function
 */
async function detectEIP897Proxy(
  client: PublicClient,
  address: Address
): Promise<Address | null> {
  try {
    const impl = await client.readContract({
      address,
      abi: [{
        name: 'implementation',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'address' }],
        stateMutability: 'view',
      }],
      functionName: 'implementation',
    });

    const implAddress = impl as Address;
    if (implAddress && implAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
      // Verify it's actually a contract by checking bytecode via eth_getCode
      try {
        const code = await client.getBytecode({ address: implAddress });
        if (code && code !== '0x') {
          return implAddress;
        }
      } catch {
        // If getBytecode fails, still return the address since implementation() returned valid data
        return implAddress;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Detect GnosisSafe Proxy via masterCopy() function or slot 0
 */
async function detectGnosisSafeProxy(
  client: PublicClient,
  address: Address
): Promise<Address | null> {
  // Try masterCopy() function first (GnosisSafe 1.3+)
  try {
    const masterCopy = await client.readContract({
      address,
      abi: [{
        name: 'masterCopy',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'address' }],
        stateMutability: 'view',
      }],
      functionName: 'masterCopy',
    });

    const masterCopyAddress = masterCopy as Address;
    if (masterCopyAddress && masterCopyAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
      return masterCopyAddress;
    }
  } catch {
    // Function doesn't exist, try storage slot
  }

  // Try slot 0 (GnosisSafe 1.0-1.2 stores masterCopy at slot 0)
  try {
    const slot0 = await client.getStorageAt({
      address,
      slot: GNOSIS_SAFE_MASTER_COPY_SLOT as `0x${string}`,
    });

    if (slot0) {
      const masterCopyAddress = extractAddressFromSlot(slot0);
      if (masterCopyAddress) {
        // Verify it looks like a GnosisSafe by checking if it has getThreshold()
        try {
          await client.readContract({
            address,
            abi: [{
              name: 'getThreshold',
              type: 'function',
              inputs: [],
              outputs: [{ type: 'uint256' }],
              stateMutability: 'view',
            }],
            functionName: 'getThreshold',
          });
          return masterCopyAddress;
        } catch {
          // Not a GnosisSafe
        }
      }
    }
  } catch {
    // Not a GnosisSafe proxy
  }

  return null;
}

/**
 * Detect ERC-8109 Diamond Proxy (Simplified) via functionFacetPairs() function
 * ERC-8109 uses a simplified introspection interface compared to EIP-2535
 * https://eips.ethereum.org/EIPS/eip-8109
 */
async function detectERC8109Diamond(
  client: PublicClient,
  address: Address
): Promise<{ facets: Address[] } | null> {
  try {
    // ERC-8109 specific: functionFacetPairs() returns array of {functionSelector, facetAddress}
    const pairs = await client.readContract({
      address,
      abi: [{
        name: 'functionFacetPairs',
        type: 'function',
        inputs: [],
        outputs: [{
          type: 'tuple[]',
          components: [
            { name: 'functionSelector', type: 'bytes4' },
            { name: 'facetAddress', type: 'address' }
          ]
        }],
        stateMutability: 'view',
      }],
      functionName: 'functionFacetPairs',
    });

    // Handle the response - extract unique facet addresses
    if (pairs && Array.isArray(pairs) && pairs.length > 0) {
      const facetSet = new Set<string>();
      for (const pair of pairs) {
        if (pair && pair.facetAddress) {
          facetSet.add(pair.facetAddress as string);
        }
      }
      if (facetSet.size > 0) {
        return { facets: Array.from(facetSet) as Address[] };
      }
    }
  } catch {
    // Not an ERC-8109 Diamond
  }

  return null;
}

/**
 * Detect EIP-2535 Diamond Proxy via facetAddresses() function
 */
async function detectDiamondProxy(
  client: PublicClient,
  address: Address
): Promise<{ facets: Address[] } | null> {
  try {
    // Try the standard Diamond Loupe facetAddresses() function
    const facets = await client.readContract({
      address,
      abi: [{
        name: 'facetAddresses',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'address[]' }],
        stateMutability: 'view',
      }],
      functionName: 'facetAddresses',
    });

    const facetArray = facets as Address[];
    if (facetArray && facetArray.length > 0) {
      return { facets: facetArray };
    }
  } catch {
    // Not a Diamond proxy or doesn't implement Loupe
  }

  // Try alternative: facets() function which returns more detailed info
  try {
    const facetsDetailed = await client.readContract({
      address,
      abi: [{
        name: 'facets',
        type: 'function',
        inputs: [],
        outputs: [{
          type: 'tuple[]',
          components: [
            { name: 'facetAddress', type: 'address' },
            { name: 'functionSelectors', type: 'bytes4[]' }
          ]
        }],
        stateMutability: 'view',
      }],
      functionName: 'facets',
    });

    const facetData = facetsDetailed as Array<{ facetAddress: Address; functionSelectors: string[] }>;
    if (facetData && facetData.length > 0) {
      return { facets: facetData.map(f => f.facetAddress) };
    }
  } catch {
    // Not a Diamond proxy
  }

  return null;
}

/**
 * Detect Compound-style Proxy via comptrollerImplementation() or specific storage slots
 */
async function detectCompoundProxy(
  client: PublicClient,
  address: Address
): Promise<Address | null> {
  // Try comptrollerImplementation() function (Compound Unitroller pattern)
  try {
    const impl = await client.readContract({
      address,
      abi: [{
        name: 'comptrollerImplementation',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'address' }],
        stateMutability: 'view',
      }],
      functionName: 'comptrollerImplementation',
    });

    const implAddress = impl as Address;
    if (implAddress && implAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
      return implAddress;
    }
  } catch {
    // Not a Compound Unitroller
  }

  // Try cTokenImplementation() function (Compound CErc20Delegator pattern)
  try {
    const impl = await client.readContract({
      address,
      abi: [{
        name: 'implementation',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'address' }],
        stateMutability: 'view',
      }],
      functionName: 'implementation',
    });

    // Check if this is a Compound-style by verifying admin() exists
    const admin = await client.readContract({
      address,
      abi: [{
        name: 'admin',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'address' }],
        stateMutability: 'view',
      }],
      functionName: 'admin',
    });

    const implAddress = impl as Address;
    const adminAddress = admin as Address;
    if (implAddress && implAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase() && adminAddress) {
      return implAddress;
    }
  } catch {
    // Not a Compound-style proxy
  }

  // Try storage slot approach for older Compound contracts
  try {
    const implSlot = await client.getStorageAt({
      address,
      slot: COMPOUND_IMPLEMENTATION_SLOT as `0x${string}`,
    });

    if (implSlot) {
      const implAddress = extractAddressFromSlot(implSlot);
      if (implAddress) {
        // Verify it's a Compound contract by checking for comptroller or underlying
        try {
          await client.readContract({
            address,
            abi: [{
              name: 'comptroller',
              type: 'function',
              inputs: [],
              outputs: [{ type: 'address' }],
              stateMutability: 'view',
            }],
            functionName: 'comptroller',
          });
          return implAddress;
        } catch {
          // Not a Compound-style
        }
      }
    }
  } catch {
    // Not a Compound proxy
  }

  return null;
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
    case 'EIP-897':
      return 'Delegate Proxy (EIP-897)';
    case 'GnosisSafe':
      return 'Gnosis Safe Proxy';
    case 'ERC-8109':
      return 'Diamond Proxy (ERC-8109 Simplified)';
    case 'EIP-2535':
      return 'Diamond Proxy (EIP-2535)';
    case 'Compound':
      return 'Compound-style Proxy';
    default:
      return 'Not a proxy';
  }
}
