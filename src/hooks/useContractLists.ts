import { useCallback, useEffect, useMemo, useState } from 'react';

export type ContractListUiMode = 'auto' | 'abi' | 'contractlist';

export type ContractListsIndexItem = {
  id: string;
  file: string;
  path: string;
  defaultUi: Exclude<ContractListUiMode, 'auto'>;
  matchContractNames: string[];
};

export type ContractListsIndex = {
  version: number;
  generatedAt: string;
  source?: {
    schemaDir?: string;
    manifestPath?: string;
  };
  items: ContractListsIndexItem[];
};

// The on-disk format is an array of "contract entries".
// We keep this mostly as unknown and parse the bits we need.
export type ContractListFile = unknown;

let cachedIndex: ContractListsIndex | null = null;
let indexLoaded = false;
let indexError: Error | null = null;

const cachedContractListsById = new Map<string, unknown>();

async function loadIndex(): Promise<ContractListsIndex | null> {
  if (indexLoaded) return cachedIndex;

  try {
    const res = await fetch('/contractlists/index.json');
    if (!res.ok) {
      indexLoaded = true;
      cachedIndex = null;
      indexError = new Error('Contractlists not available');
      return null;
    }

    const index = (await res.json()) as ContractListsIndex;
    cachedIndex = index;
    indexLoaded = true;
    indexError = null;
    return index;
  } catch (e) {
    indexLoaded = true;
    cachedIndex = null;
    indexError = e as Error;
    return null;
  }
}

async function loadContractListById(id: string): Promise<unknown | null> {
  if (cachedContractListsById.has(id)) {
    return cachedContractListsById.get(id) ?? null;
  }

  const index = await loadIndex();
  const item = index?.items?.find((i) => i.id === id);
  if (!item) return null;

  try {
    const res = await fetch(item.path);
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    cachedContractListsById.set(id, json);
    return json;
  } catch {
    return null;
  }
}

export function invalidateContractListsCache(): void {
  cachedIndex = null;
  indexLoaded = false;
  indexError = null;
  cachedContractListsById.clear();
}

export function useContractLists() {
  const [index, setIndex] = useState<ContractListsIndex | null>(cachedIndex);
  const [loading, setLoading] = useState(!indexLoaded);
  const [error, setError] = useState<Error | null>(indexError);

  useEffect(() => {
    if (indexLoaded) {
      setIndex(cachedIndex);
      setLoading(false);
      setError(indexError);
      return;
    }

    loadIndex()
      .then((idx) => {
        setIndex(idx);
        setLoading(false);
        setError(indexError);
      })
      .catch((e) => {
        setIndex(null);
        setLoading(false);
        setError(e);
      });
  }, []);

  const getContractList = useCallback(async (id: string) => {
    return loadContractListById(id);
  }, []);

  const findMatchForContractName = useCallback(
    (contractName: string | undefined | null) => {
      if (!contractName || !index?.items) return null;
      const normalized = contractName.trim();
      if (!normalized) return null;

      return (
        index.items.find((i) => i.matchContractNames?.includes(normalized)) ??
        null
      );
    },
    [index]
  );

  const ids = useMemo(() => index?.items?.map((i) => i.id) ?? [], [index]);

  return {
    index,
    ids,
    loading,
    error,
    getContractList,
    findMatchForContractName,
  };
}
