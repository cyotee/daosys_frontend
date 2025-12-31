import { useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { isAddress, type Address } from 'viem';
import { detectProxy, type ProxyInfo, type ProxyType } from '@/utils/proxyDetection';

export type ProxyDetectionState = 'idle' | 'detecting' | 'detected' | 'error';

export interface UseProxyDetectionResult {
  proxyInfo: ProxyInfo | null;
  detectionState: ProxyDetectionState;
  error: Error | null;
  detect: (address: string) => Promise<ProxyInfo | null>;
  reset: () => void;
}

/**
 * Hook for detecting if a contract is a proxy
 */
export function useProxyDetection(): UseProxyDetectionResult {
  const client = usePublicClient();
  const [proxyInfo, setProxyInfo] = useState<ProxyInfo | null>(null);
  const [detectionState, setDetectionState] = useState<ProxyDetectionState>('idle');
  const [error, setError] = useState<Error | null>(null);

  const detect = useCallback(async (address: string): Promise<ProxyInfo | null> => {
    if (!address || !isAddress(address)) {
      setError(new Error('Invalid address'));
      setDetectionState('error');
      return null;
    }

    setDetectionState('detecting');
    setError(null);

    try {
      const info = await detectProxy(client, address as Address);
      setProxyInfo(info);
      setDetectionState('detected');
      return info;
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Unknown error detecting proxy');
      setError(err);
      setDetectionState('error');
      return null;
    }
  }, [client]);

  const reset = useCallback(() => {
    setProxyInfo(null);
    setDetectionState('idle');
    setError(null);
  }, []);

  return {
    proxyInfo,
    detectionState,
    error,
    detect,
    reset,
  };
}

export default useProxyDetection;
