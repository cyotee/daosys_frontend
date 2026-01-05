/**
 * @jest-environment jsdom
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useLoadContract, ContractLoadingState } from '../useLoadContract';
import contractsSlice from '@/store/features/contracts/contractsSlice';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useWalletClient: jest.fn(() => ({ data: null })),
  usePublicClient: jest.fn(() => ({
    getChainId: jest.fn().mockResolvedValue(1),
  })),
}));

// Mock sourcify decoder
jest.mock('@ethereum-sourcify/contract-call-decoder', () => ({
  MetadataSources: {
    Sourcify: 'sourcify',
    BytecodeMetadata: 'bytecode',
  },
  getMetadataFromAddress: jest.fn(),
}));

// Mock useLocalAbis
jest.mock('@/hooks/useLocalAbis', () => ({
  getLocalAbi: jest.fn(),
}));

// Mock debug helpers
jest.mock('@/utils/debug', () => ({
  debugLog: jest.fn(),
  debugError: jest.fn(),
}));

// Mock viem functions
jest.mock('viem', () => ({
  isAddress: jest.fn((addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr)),
  getContract: jest.fn((params: { address: string; abi: any[] }) => ({
    address: params.address,
    abi: params.abi,
    read: {},
    write: {},
    simulate: {},
  })),
}));

import { useWalletClient, usePublicClient } from 'wagmi';
import { getMetadataFromAddress, MetadataSources } from '@ethereum-sourcify/contract-call-decoder';
import { getLocalAbi } from '@/hooks/useLocalAbis';
import { isAddress, getContract } from 'viem';
import { debugError } from '@/utils/debug';

// Test store factory
function createTestStore() {
  return configureStore({
    reducer: {
      contractsSlice,
    },
    preloadedState: {
      contractsSlice: {
        items: {},
      },
    },
  });
}

// Test wrapper with Redux Provider
function createWrapper() {
  const store = createTestStore();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(Provider as any, { store }, children);
  };
}

const validAddress = '0x1234567890123456789012345678901234567890';
const invalidAddress = 'invalid-address';
const mockAbi = [{ type: 'function' as const, name: 'test', inputs: [], outputs: [], stateMutability: 'view' as const }];

describe('useLoadContract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('address validation', () => {
    it('sets invalid-address state for invalid addresses', async () => {
      const { result } = renderHook(
        () => useLoadContract(invalidAddress),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loadingState).toBe('invalid-address');
      });
    });

    it('sets none state for valid addresses', async () => {
      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loadingState).toBe('none');
      });
    });

    it('updates state when address changes from valid to invalid', async () => {
      const { result, rerender } = renderHook(
        ({ address }) => useLoadContract(address),
        {
          wrapper: createWrapper(),
          initialProps: { address: validAddress },
        }
      );

      await waitFor(() => {
        expect(result.current.loadingState).toBe('none');
      });

      rerender({ address: invalidAddress });

      await waitFor(() => {
        expect(result.current.loadingState).toBe('invalid-address');
      });
    });
  });

  describe('loadContract', () => {
    it('loads a contract with a valid address and ABI', async () => {
      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loadingState).toBe('none');
      });

      let contractResult: any;
      await act(async () => {
        contractResult = await result.current.loadContract(validAddress, mockAbi);
      });

      expect(contractResult).toBeTruthy();
      expect(getContract).toHaveBeenCalledWith({
        address: validAddress,
        abi: mockAbi,
        walletClient: undefined,
        publicClient: expect.anything(),
      });
      expect(result.current.loadingState).toBe('contract-loaded');
      expect(result.current.contract).toBeTruthy();
    });

    it('returns false for invalid address', async () => {
      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      let loadResult: any;
      await act(async () => {
        loadResult = await result.current.loadContract('0x123', mockAbi);
      });

      expect(loadResult).toBe(false);
    });

    it('handles errors during contract loading', async () => {
      (getContract as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Contract loading failed');
      });

      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      let loadResult: any;
      await act(async () => {
        loadResult = await result.current.loadContract(validAddress, mockAbi);
      });

      expect(loadResult).toBe(false);
      expect(result.current.loadingState).toBe('contract-error');
      expect(debugError).toHaveBeenCalled();
    });
  });

  describe('loadLocalAbi', () => {
    it('loads ABI from local manifest and creates contract', async () => {
      (getLocalAbi as jest.Mock).mockResolvedValueOnce({
        name: 'TestContract',
        abi: mockAbi,
        sourcePath: 'src/Test.sol',
      });

      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      let loadResult: any;
      await act(async () => {
        loadResult = await result.current.loadLocalAbi(validAddress, 'TestContract');
      });

      expect(loadResult).toBe(true);
      expect(getLocalAbi).toHaveBeenCalledWith('TestContract');
      expect(result.current.loadingState).toBe('contract-loaded');
    });

    it('returns false when local ABI is not found', async () => {
      (getLocalAbi as jest.Mock).mockResolvedValueOnce(null);

      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      let loadResult: any;
      await act(async () => {
        loadResult = await result.current.loadLocalAbi(validAddress, 'NonExistent');
      });

      expect(loadResult).toBe(false);
      expect(result.current.loadingState).toBe('metadata-not-found');
    });

    it('handles errors during local ABI loading', async () => {
      (getLocalAbi as jest.Mock).mockRejectedValueOnce(new Error('Load failed'));

      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      let loadResult: any;
      await act(async () => {
        loadResult = await result.current.loadLocalAbi(validAddress, 'TestContract');
      });

      expect(loadResult).toBe(false);
      expect(result.current.loadingState).toBe('abi-error');

      consoleSpy.mockRestore();
    });
  });

  describe('loadContractMetadata', () => {
    it('loads metadata from Sourcify and creates contract', async () => {
      (getMetadataFromAddress as jest.Mock).mockResolvedValueOnce({
        output: { abi: mockAbi },
      });

      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.loadContractMetadata(MetadataSources.Sourcify, 1);
      });

      expect(getMetadataFromAddress).toHaveBeenCalledWith({
        address: validAddress,
        source: MetadataSources.Sourcify,
        chainId: 1,
      });
      expect(result.current.loadingState).toBe('contract-loaded');
    });

    it('loads metadata from BytecodeMetadata and creates contract', async () => {
      (getMetadataFromAddress as jest.Mock).mockResolvedValueOnce({
        output: { abi: mockAbi },
      });

      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.loadContractMetadata(MetadataSources.BytecodeMetadata, 1);
      });

      expect(getMetadataFromAddress).toHaveBeenCalledWith({
        address: validAddress,
        source: MetadataSources.BytecodeMetadata,
        rpcProvider: expect.anything(),
      });
      expect(result.current.loadingState).toBe('contract-loaded');
    });

    it('sets metadata-not-found when no metadata is returned', async () => {
      (getMetadataFromAddress as jest.Mock).mockResolvedValueOnce(null);

      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.loadContractMetadata(MetadataSources.Sourcify, 1);
      });

      expect(result.current.loadingState).toBe('metadata-not-found');
    });

    it('handles errors during metadata loading', async () => {
      (getMetadataFromAddress as jest.Mock).mockRejectedValueOnce(new Error('Fetch failed'));

      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await act(async () => {
        await result.current.loadContractMetadata(MetadataSources.Sourcify, 1);
      });

      expect(result.current.loadingState).toBe('metadata-not-found');

      consoleSpy.mockRestore();
    });
  });

  describe('resetState', () => {
    it('resets loading state and contract to initial values', async () => {
      (getLocalAbi as jest.Mock).mockResolvedValueOnce({
        name: 'TestContract',
        abi: mockAbi,
      });

      const { result } = renderHook(
        () => useLoadContract(validAddress),
        { wrapper: createWrapper() }
      );

      // First load a contract
      await act(async () => {
        await result.current.loadLocalAbi(validAddress, 'TestContract');
      });

      expect(result.current.loadingState).toBe('contract-loaded');
      expect(result.current.contract).toBeTruthy();

      // Then reset
      act(() => {
        result.current.resetState();
      });

      expect(result.current.loadingState).toBe('none');
      expect(result.current.contract).toBeUndefined();
    });
  });

  describe('contract name', () => {
    it('accepts an optional contract name parameter', async () => {
      const { result } = renderHook(
        () => useLoadContract(validAddress, 'MyContract'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.loadingState).toBe('none');
      });
    });
  });
});
