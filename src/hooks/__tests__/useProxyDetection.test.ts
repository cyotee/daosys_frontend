import { renderHook, act, waitFor } from '@testing-library/react';
import { useProxyDetection } from '../useProxyDetection';

// Mock wagmi
jest.mock('wagmi', () => ({
  usePublicClient: jest.fn(),
}));

// Mock the proxyDetection utility
jest.mock('@/utils/proxyDetection', () => ({
  detectProxy: jest.fn(),
}));

import { usePublicClient } from 'wagmi';
import { detectProxy } from '@/utils/proxyDetection';

const mockUsePublicClient = usePublicClient as jest.Mock;
const mockDetectProxy = detectProxy as jest.Mock;

describe('useProxyDetection', () => {
  const mockClient = {
    getStorageAt: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePublicClient.mockReturnValue(mockClient);
  });

  it('should initialize with idle state', () => {
    const { result } = renderHook(() => useProxyDetection());

    expect(result.current.proxyInfo).toBeNull();
    expect(result.current.detectionState).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('should detect proxy successfully', async () => {
    const mockProxyInfo = {
      isProxy: true,
      proxyType: 'EIP-1967',
      implementationAddress: '0x1234567890123456789012345678901234567890',
      beaconAddress: null,
      adminAddress: null,
      facetAddresses: null,
    };

    mockDetectProxy.mockResolvedValue(mockProxyInfo);

    const { result } = renderHook(() => useProxyDetection());

    await act(async () => {
      await result.current.detect('0x1234567890123456789012345678901234567890');
    });

    expect(result.current.detectionState).toBe('detected');
    expect(result.current.proxyInfo).toEqual(mockProxyInfo);
    expect(result.current.error).toBeNull();
  });

  it('should return error for invalid address', async () => {
    const { result } = renderHook(() => useProxyDetection());

    await act(async () => {
      await result.current.detect('invalid-address');
    });

    expect(result.current.detectionState).toBe('error');
    expect(result.current.error?.message).toBe('Invalid address');
    expect(result.current.proxyInfo).toBeNull();
  });

  it('should return error for empty address', async () => {
    const { result } = renderHook(() => useProxyDetection());

    await act(async () => {
      await result.current.detect('');
    });

    expect(result.current.detectionState).toBe('error');
    expect(result.current.error?.message).toBe('Invalid address');
  });

  it('should handle detection errors gracefully', async () => {
    mockDetectProxy.mockRejectedValue(new Error('RPC error'));

    const { result } = renderHook(() => useProxyDetection());

    await act(async () => {
      await result.current.detect('0x1234567890123456789012345678901234567890');
    });

    expect(result.current.detectionState).toBe('error');
    expect(result.current.error?.message).toBe('RPC error');
    expect(result.current.proxyInfo).toBeNull();
  });

  it('should handle unknown errors', async () => {
    mockDetectProxy.mockRejectedValue('Unknown error');

    const { result } = renderHook(() => useProxyDetection());

    await act(async () => {
      await result.current.detect('0x1234567890123456789012345678901234567890');
    });

    expect(result.current.detectionState).toBe('error');
    expect(result.current.error?.message).toBe('Unknown error detecting proxy');
  });

  it('should reset state', async () => {
    const mockProxyInfo = {
      isProxy: true,
      proxyType: 'EIP-1967',
      implementationAddress: '0x1234567890123456789012345678901234567890',
      beaconAddress: null,
      adminAddress: null,
      facetAddresses: null,
    };

    mockDetectProxy.mockResolvedValue(mockProxyInfo);

    const { result } = renderHook(() => useProxyDetection());

    await act(async () => {
      await result.current.detect('0x1234567890123456789012345678901234567890');
    });

    expect(result.current.proxyInfo).toEqual(mockProxyInfo);

    act(() => {
      result.current.reset();
    });

    expect(result.current.proxyInfo).toBeNull();
    expect(result.current.detectionState).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('should set detecting state while detection is in progress', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockDetectProxy.mockReturnValue(promise);

    const { result } = renderHook(() => useProxyDetection());

    // Start detection but don't await
    act(() => {
      result.current.detect('0x1234567890123456789012345678901234567890');
    });

    // Should be in detecting state
    expect(result.current.detectionState).toBe('detecting');

    // Resolve the promise
    await act(async () => {
      resolvePromise!({
        isProxy: false,
        proxyType: 'none',
        implementationAddress: null,
        beaconAddress: null,
        adminAddress: null,
        facetAddresses: null,
      });
    });

    expect(result.current.detectionState).toBe('detected');
  });

  it('should return null from detect for invalid address', async () => {
    const { result } = renderHook(() => useProxyDetection());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.detect('invalid');
    });

    expect(returnValue).toBeNull();
  });

  it('should return proxyInfo from detect on success', async () => {
    const mockProxyInfo = {
      isProxy: false,
      proxyType: 'none',
      implementationAddress: null,
      beaconAddress: null,
      adminAddress: null,
      facetAddresses: null,
    };

    mockDetectProxy.mockResolvedValue(mockProxyInfo);

    const { result } = renderHook(() => useProxyDetection());

    let returnValue: any;
    await act(async () => {
      returnValue = await result.current.detect('0x1234567890123456789012345678901234567890');
    });

    expect(returnValue).toEqual(mockProxyInfo);
  });

  it('should detect Diamond proxy with facet addresses', async () => {
    const mockProxyInfo = {
      isProxy: true,
      proxyType: 'EIP-2535',
      implementationAddress: '0xfacet11234567890facet11234567890facet112',
      beaconAddress: null,
      adminAddress: null,
      facetAddresses: [
        '0xfacet11234567890facet11234567890facet112',
        '0xfacet21234567890facet21234567890facet212',
      ],
    };

    mockDetectProxy.mockResolvedValue(mockProxyInfo);

    const { result } = renderHook(() => useProxyDetection());

    await act(async () => {
      await result.current.detect('0x1234567890123456789012345678901234567890');
    });

    expect(result.current.detectionState).toBe('detected');
    expect(result.current.proxyInfo?.proxyType).toBe('EIP-2535');
    expect(result.current.proxyInfo?.facetAddresses).toHaveLength(2);
  });
});
