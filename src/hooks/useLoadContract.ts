import { debugError } from '@/utils/debug';
import { useState, useCallback, useMemo, useEffect } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { MetadataSources, getMetadataFromAddress } from "@ethereum-sourcify/contract-call-decoder";
import { EthereumProvider } from "ethereum-provider";
import { isAddress, getContract, type Abi, type Address } from "viem";
import { useAppDispatch } from "@/store/hooks";
import { addContract } from "@/store/features/contracts/contractsSlice";
import { getLocalAbi } from '@/hooks/useLocalAbis';

export type ContractLoadingState =
    'none' |
    'invalid-address' |
    'loading-metadata' |
    'metadata-not-found' |
    'loading-abi' |
    'abi-error' |
    'loading-contract' |
    'contract-error' |
    'contract-loaded';

// Contract instance type - using generic object since viem's GetContractReturnType
// requires complex generics that depend on the specific ABI
type ContractInstance = {
    address: Address;
    abi: Abi;
    read?: Record<string, unknown>;
    write?: Record<string, unknown>;
    simulate?: Record<string, unknown>;
};

export const useLoadContract = (
    contractAddress: string,
    contractName?: string | undefined
) => {
    const client = usePublicClient();
    const wallet = useWalletClient();

    const dispatch = useAppDispatch();

    const [loadingState, setLoadingState] = useState<ContractLoadingState>('none');
    const [contract, setContract] = useState<ContractInstance | undefined>(undefined);

    const [isMetadataAvailable, setIsMetadataAvailable] = useState<boolean>(false);
    const [contractMetdataSource, setContractMetdataSource] = useState<MetadataSources | undefined>(undefined);
    const [metadataAtChainId, setMetadataAtChainId] = useState<number | undefined>(undefined);


    useEffect(() => {
        if (!isAddress(contractAddress)) {
            setLoadingState('invalid-address');
        } else {
            setLoadingState('none');
        }
    }, [contractAddress]);

    useEffect(() => {
        if (contract && contractAddress.length > 10) {
            setLoadingState('contract-loaded');
            dispatch(addContract({
                address: contractAddress,
                contract: {
                    abi: contract.abi,
                    name: contractName || undefined,
                    metadataAvailable: isMetadataAvailable,
                    metadataAtChainId: metadataAtChainId,
                    metadataSource: contractMetdataSource,
                }
            }));
        }
    }, [contract, contractAddress, contractMetdataSource, contractName, dispatch, isMetadataAvailable, metadataAtChainId]);



    const loadContract = useCallback(async (addressToLoad: string, abi: Abi) => {
        try {
            if (addressToLoad.length !== 42 || !isAddress(addressToLoad)) {
                return false;
            }

            if (!client) {
                setLoadingState('contract-error');
                return false;
            }

            setLoadingState('loading-contract');

            const contractClient = wallet.data
                ? { public: client, wallet: wallet.data }
                : client;

            const contractInstance = getContract({
                address: addressToLoad as Address,
                abi: abi,
                client: contractClient,
            });

            setLoadingState('contract-loaded');
            setContract(contractInstance as ContractInstance);
            return contractInstance;
        } catch (e) {
            debugError('Failed to load contract:', e);
            setLoadingState('contract-error');
            return false;
        }
    }, [wallet.data, client]);


    const loadLocalAbi = useCallback(async (addressToLoad: string, name: string) => {
        try {
            setLoadingState('loading-abi');
            const json = await getLocalAbi(name);
            if (!json || !json.abi) {
                setLoadingState('metadata-not-found');
                return false;
            }
            // Ensure abi is an array
            const abi = Array.isArray(json.abi) ? json.abi : JSON.parse(json.abi);
            await loadContract(addressToLoad, abi as Abi);
            return true;
        } catch (e) {
            debugError('Failed to load local ABI:', e);
            setLoadingState('abi-error');
            return false;
        }
    }, [loadContract]);


    const loadContractMetadata = useCallback(async (metadataSource: MetadataSources, chainId: number) => {

        if (!client) {
            setLoadingState('metadata-not-found');
            return;
        }

        const metadataFetchPayload = {
            address: contractAddress,
            source: metadataSource,
            ...(metadataSource === MetadataSources.Sourcify ? { chainId: chainId } : {}),
            ...(metadataSource === MetadataSources.BytecodeMetadata ? { rpcProvider: client as unknown as EthereumProvider } : {}),
        }

        try {
            setLoadingState('loading-metadata');

            const metadata = await getMetadataFromAddress(metadataFetchPayload);

            if (!metadata) {
                setLoadingState('metadata-not-found');
            } else {
                setLoadingState('loading-abi');

                const abi = metadata.output.abi as Abi;
                setIsMetadataAvailable(true);
                setMetadataAtChainId(
                    metadataSource === MetadataSources.Sourcify ? chainId : await client.getChainId()
                );
                setContractMetdataSource(metadataSource);

                await loadContract(contractAddress, abi);
            }
        } catch (e) {
            debugError('Failed to load contract metadata:', e);
            setLoadingState('metadata-not-found');
        }
    }, [client, contractAddress, loadContract]);



    return useMemo(() => ({
        loadingState,
        loadContractMetadata,
        loadContract,
        loadLocalAbi,
        contract,
        resetState: () => {
            setLoadingState('none');
            setContract(undefined);
        }
    }), [loadingState, loadContractMetadata, loadContract, loadLocalAbi, contract]);

}
