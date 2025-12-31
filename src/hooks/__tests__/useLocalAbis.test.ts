/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useLocalAbis,
  listLocalAbis,
  getLocalAbi,
  invalidateManifestCache,
  type LocalAbiManifest,
} from '../useLocalAbis';
import { hasLocalAbis } from '@/utils/deploymentMode';

// Sample manifest for testing
const mockManifest: LocalAbiManifest = {
  contracts: {
    TestContract: {
      abi: [{ type: 'function', name: 'test', inputs: [], outputs: [] }],
      sourcePath: 'src/TestContract.sol',
    },
    AnotherContract: {
      abi: [{ type: 'function', name: 'doSomething', inputs: [], outputs: [] }],
      sourcePath: 'src/AnotherContract.sol',
    },
  },
  projectType: 'foundry',
  projectDir: '/path/to/project',
  outDir: 'out',
  generatedAt: '2024-01-01T00:00:00.000Z',
  contractCount: 2,
};

const emptyManifest: LocalAbiManifest = {
  contracts: {},
  projectType: null,
  projectDir: null,
  generatedAt: '2024-01-01T00:00:00.000Z',
  contractCount: 0,
  empty: true,
};

describe('useLocalAbis', () => {
  beforeEach(() => {
    // Reset cache and mocks before each test
    invalidateManifestCache();
    jest.clearAllMocks();
    (window as any).__LOCAL_ABIS_AVAILABLE = undefined;
  });

  describe('listLocalAbis', () => {
    it('returns contract names from manifest', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest,
      });

      const result = await listLocalAbis();

      expect(result.names).toEqual(['TestContract', 'AnotherContract']);
      expect(result.projectType).toBe('foundry');
      expect(result.projectDir).toBe('/path/to/project');
      expect(result.total).toBe(2);
    });

    it('returns empty result when manifest is empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => emptyManifest,
      });

      const result = await listLocalAbis();

      expect(result.names).toEqual([]);
      expect(result.projectType).toBeNull();
      expect(result.projectDir).toBeNull();
      expect(result.total).toBe(0);
    });

    it('returns empty result when fetch fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await listLocalAbis();

      expect(result.names).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('caches the manifest after first load', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest,
      });

      // First call - should fetch
      await listLocalAbis();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await listLocalAbis();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLocalAbi', () => {
    it('returns the ABI for an existing contract', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest,
      });

      const result = await getLocalAbi('TestContract');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('TestContract');
      expect(result?.abi).toEqual([{ type: 'function', name: 'test', inputs: [], outputs: [] }]);
      expect(result?.sourcePath).toBe('src/TestContract.sol');
    });

    it('returns null for non-existent contract', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest,
      });

      const result = await getLocalAbi('NonExistentContract');

      expect(result).toBeNull();
    });

    it('returns null when manifest is empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => emptyManifest,
      });

      const result = await getLocalAbi('TestContract');

      expect(result).toBeNull();
    });

    it('returns null when fetch fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getLocalAbi('TestContract');

      expect(result).toBeNull();
    });
  });

  describe('useLocalAbis hook', () => {
    it('loads manifest and provides contract data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest,
      });

      const { result } = renderHook(() => useLocalAbis());

      // Initially loading
      expect(result.current.loading).toBe(true);

      // Wait for load to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.manifest).toEqual(mockManifest);
      expect(result.current.hasAbis).toBe(true);
      expect(result.current.contractNames).toEqual(['TestContract', 'AnotherContract']);
      expect(result.current.projectType).toBe('foundry');
      expect(result.current.projectDir).toBe('/path/to/project');
      expect(result.current.error).toBeNull();
    });

    it('handles empty manifest', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => emptyManifest,
      });

      const { result } = renderHook(() => useLocalAbis());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasAbis).toBe(false);
      expect(result.current.contractNames).toEqual([]);
    });

    it('handles fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useLocalAbis());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.manifest).toBeNull();
    });

    it('provides getAbi callback', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest,
      });

      const { result } = renderHook(() => useLocalAbis());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const abi = await result.current.getAbi('TestContract');
      expect(abi?.name).toBe('TestContract');
    });

    it('provides listAbis callback', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest,
      });

      const { result } = renderHook(() => useLocalAbis());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const list = await result.current.listAbis();
      expect(list.names).toEqual(['TestContract', 'AnotherContract']);
    });
  });

  describe('invalidateManifestCache', () => {
    it('clears the cache forcing a re-fetch', async () => {
      // First load
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest,
      });

      await listLocalAbis();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Invalidate cache
      invalidateManifestCache();

      // Second load should fetch again
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockManifest,
          contractCount: 5, // different value
        }),
      });

      const result = await listLocalAbis();
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.total).toBe(2); // Still uses original contract count from keys
    });
  });

  describe('setLocalAbisAvailable integration', () => {
    it('sets local ABIs as available when manifest has contracts', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockManifest,
      });

      await listLocalAbis();

      expect(hasLocalAbis()).toBe(true);
    });

    it('sets local ABIs as unavailable when manifest is empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => emptyManifest,
      });

      await listLocalAbis();

      expect(hasLocalAbis()).toBe(false);
    });

    it('sets local ABIs as unavailable when fetch fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await listLocalAbis();

      expect(hasLocalAbis()).toBe(false);
    });
  });
});
