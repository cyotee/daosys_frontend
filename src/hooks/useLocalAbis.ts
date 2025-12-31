import { useState, useEffect, useCallback } from 'react';
import { setLocalAbisAvailable } from '@/utils/deploymentMode';

export interface LocalAbiManifest {
  contracts: {
    [name: string]: {
      abi: any[];
      sourcePath?: string;
    };
  };
  projectType: 'foundry' | 'hardhat' | 'override' | null;
  projectDir: string | null;
  outDir?: string;
  generatedAt: string;
  contractCount: number;
  empty?: boolean;
}

// Cache the manifest in memory
let cachedManifest: LocalAbiManifest | null = null;
let manifestLoaded = false;
let manifestError: Error | null = null;

/**
 * Load the local ABI manifest from the static JSON file
 */
async function loadManifest(): Promise<LocalAbiManifest | null> {
  if (manifestLoaded) {
    return cachedManifest;
  }

  try {
    const res = await fetch('/local-abis.json');
    if (!res.ok) {
      manifestLoaded = true;
      manifestError = new Error('Local ABIs not available');
      setLocalAbisAvailable(false);
      return null;
    }

    const manifest = await res.json() as LocalAbiManifest;
    cachedManifest = manifest;
    manifestLoaded = true;

    // Check if there are any contracts
    const hasContracts = manifest.contracts && Object.keys(manifest.contracts).length > 0;
    setLocalAbisAvailable(hasContracts && !manifest.empty);

    return manifest;
  } catch (e) {
    manifestLoaded = true;
    manifestError = e as Error;
    setLocalAbisAvailable(false);
    return null;
  }
}

/**
 * List all available local ABIs
 */
export async function listLocalAbis(): Promise<{
  names: string[];
  projectType: string | null;
  projectDir: string | null;
  total: number;
}> {
  const manifest = await loadManifest();

  if (!manifest || manifest.empty) {
    return {
      names: [],
      projectType: null,
      projectDir: null,
      total: 0
    };
  }

  const names = Object.keys(manifest.contracts);

  return {
    names,
    projectType: manifest.projectType,
    projectDir: manifest.projectDir,
    total: names.length
  };
}

/**
 * Get a specific local ABI by contract name
 */
export async function getLocalAbi(name: string): Promise<{
  name: string;
  abi: any[];
  sourcePath?: string;
} | null> {
  const manifest = await loadManifest();

  if (!manifest || manifest.empty) {
    return null;
  }

  const contract = manifest.contracts[name];
  if (!contract) {
    return null;
  }

  return {
    name,
    abi: contract.abi,
    sourcePath: contract.sourcePath
  };
}

/**
 * React hook for accessing local ABIs
 */
export function useLocalAbis() {
  const [manifest, setManifest] = useState<LocalAbiManifest | null>(cachedManifest);
  const [loading, setLoading] = useState(!manifestLoaded);
  const [error, setError] = useState<Error | null>(manifestError);

  useEffect(() => {
    if (manifestLoaded) {
      setManifest(cachedManifest);
      setLoading(false);
      setError(manifestError);
      return;
    }

    loadManifest()
      .then((m) => {
        setManifest(m);
        setLoading(false);
        // Check for error that was caught internally by loadManifest
        setError(manifestError);
      })
      .catch((e) => {
        setError(e);
        setLoading(false);
      });
  }, []);

  const getAbi = useCallback(async (name: string) => {
    return getLocalAbi(name);
  }, []);

  const listAbis = useCallback(async () => {
    return listLocalAbis();
  }, []);

  const hasAbis = manifest && !manifest.empty && manifest.contractCount > 0;
  const contractNames = manifest ? Object.keys(manifest.contracts) : [];

  return {
    manifest,
    loading,
    error,
    hasAbis,
    contractNames,
    getAbi,
    listAbis,
    projectType: manifest?.projectType || null,
    projectDir: manifest?.projectDir || null
  };
}

/**
 * Force reload the manifest (useful after watch mode updates)
 */
export function invalidateManifestCache(): void {
  cachedManifest = null;
  manifestLoaded = false;
  manifestError = null;
}
