import Box from "@/components/Box";
import React, { FC, useEffect, useMemo, useState } from "react";
import { TabAdd } from "./TabAdd";
import { ContractSelector } from "../../contracts/components/ContractSelector";
import { useContractsList } from "../../contracts/hooks/useContractsList";
import { useAppSelector } from "@/store/hooks";
import { MetadataSources, getMetadataFromAddress } from "@ethereum-sourcify/contract-call-decoder";
import { useChainId, usePublicClient, useWalletClient } from "wagmi";
import { EthereumProvider } from "ethereum-provider";
import { Divider, Grid } from "@mui/material";
import { TabSettings } from "./TabSettings";
import { TabInfoBlock } from "./TabInfoBlock";
import { TabModeSwitcher } from "./TabModeSwitcher";
import { TabSwitcherMode } from "../types";
import { ContractItem } from "../../contracts/contractsSlice";
import { TabMethod } from "./TabMethod";
import { AbiFunction } from "abitype";
import { Tab, setTabContractAddress } from "../tabsSlice";
import { SimulateContractReturnType, type Address, isAddress } from "viem";
import { Simulate } from "react-dom/test-utils";
import { useHistory } from "../../history/hooks/useHistory";
import { useContractLists, type ContractListUiMode } from "@/hooks/useContractLists";
import { safeStringify } from "@/utils/safeJson";
import { debugLog, debugError } from "@/utils/debug";

export type TabViewerProps = {
    tabId: string | undefined;
}

export const TabViewer: FC<TabViewerProps> = (props: TabViewerProps) => {

    // tab updater

    const { findContract } = useContractsList({});
    const allTabs = useAppSelector(state => state.tabsSlice.tabs);

    const [tabInfo, setTabInfo] = useState<Tab | undefined>(undefined);

    const userChainId = useChainId();
    const client = usePublicClient({ chainId: userChainId });
    const { data: wallet } = useWalletClient();

    const [mode, setMode] = useState<TabSwitcherMode>("read");

    const [contractAddress, setContractAddress] = useState<string | undefined>(undefined);
    const [contract, setContract] = useState<ContractItem | undefined>(undefined);

    const tabUiMode = useAppSelector(state => state.tabsSlice.tabs.find(tab => tab.id === props.tabId)?.uiMode) as ContractListUiMode | undefined;
    const tabContractListId = useAppSelector(state => state.tabsSlice.tabs.find(tab => tab.id === props.tabId)?.contractListId) as string | undefined;

    const { index: contractListsIndex, getContractList, findMatchForContractName } = useContractLists();
    const [contractListJson, setContractListJson] = useState<unknown | null>(null);

    const {
        addRead,
        addWrite
    } = useHistory();

    const matchFromName = useMemo(() => {
        return findMatchForContractName(contract?.name);
    }, [findMatchForContractName, contract?.name]);

    const effectiveContractListId = useMemo(() => {
        return tabContractListId || matchFromName?.id || undefined;
    }, [tabContractListId, matchFromName]);

    const effectiveUiMode: ContractListUiMode = useMemo(() => {
        if (tabUiMode) return tabUiMode;
        if (matchFromName?.defaultUi) return matchFromName.defaultUi;
        return 'auto';
    }, [tabUiMode, matchFromName]);

    useEffect(() => {
        if (!effectiveContractListId) {
            setContractListJson(null);
            return;
        }

        // Only load the contractlist when it's potentially used.
        if (effectiveUiMode === 'abi') {
            setContractListJson(null);
            return;
        }

        getContractList(effectiveContractListId)
            .then((json) => setContractListJson(json))
            .catch(() => setContractListJson(null));
    }, [effectiveContractListId, effectiveUiMode, getContractList]);

    const abiFunctionMap = useMemo(() => {
        const map = new Map<string, AbiFunction>();
        if (!contract?.abi) return map;
        // @ts-ignore
        for (const item of contract.abi as any[]) {
            if (item && item.type === 'function' && typeof item.name === 'string') {
                map.set(item.name, item as AbiFunction);
            }
        }
        return map;
    }, [contract?.abi]);

    function extractContractListFn(entry: any): { functionName: string; label: string; meta: any } | null {
        if (!entry || typeof entry !== 'object') return null;
        for (const [k, v] of Object.entries(entry)) {
            if (typeof v === 'string') {
                return { functionName: k, label: v, meta: entry };
            }
        }
        return null;
    }

    const filteredMethods = useMemo<Array<{ method: AbiFunction; displayName?: string; meta?: any }>>(() => {
        if (undefined === contract) return [] as Array<{ method: AbiFunction; displayName?: string; meta?: any }>;
        if ('' === (contract as any).abi || !contractAddress) return [] as Array<{ method: AbiFunction; displayName?: string; meta?: any }>;

        const canUseContractList = effectiveUiMode === 'contractlist' || (effectiveUiMode === 'auto' && !!effectiveContractListId);
        const hasContractList = Array.isArray(contractListJson) && (contractListJson as any[]).length > 0;

        if (canUseContractList && hasContractList) {
            // Format: [ { chainId, ..., functions: [ { fnName: "Label", ... } ] } ]
            const first = (contractListJson as any[])[0];
            const entries = Array.isArray(first?.functions) ? first.functions : [];

            const wantedNames = new Set<string>();
            for (const entry of entries) {
                const ex = extractContractListFn(entry);
                if (ex) wantedNames.add(ex.functionName);
            }

            const abiFiltered = Array.from(wantedNames)
                .map((name) => {
                    const fn = abiFunctionMap.get(name);
                    if (!fn) return null;
                    const entry = entries.find((e: any) => {
                        const ex = extractContractListFn(e);
                        return ex?.functionName === name;
                    });
                    const ex = extractContractListFn(entry);
                    return { method: fn, displayName: ex?.label, meta: ex?.meta };
                })
                .filter(Boolean) as Array<{ method: AbiFunction; displayName?: string; meta?: any }>;

            // Preserve read/write mode filtering.
            if (mode === 'read') {
                return abiFiltered.filter((x) => (x.method as any).stateMutability === 'view' || (x.method as any).stateMutability === 'pure');
            }
            if (mode === 'write') {
                return abiFiltered.filter((x) => (x.method as any).stateMutability === 'nonpayable' || (x.method as any).stateMutability === 'payable');
            }
            return abiFiltered;
        }

        // Default: ABI-driven method list.
        if (mode === "read") {
            // @ts-ignore
            return (contract.abi.filter((method: { stateMutability: string; }) => method.stateMutability === "view" || method.stateMutability === "pure") ?? [])
                .map((m: any) => ({ method: m as AbiFunction }));
        } else if (mode === "write") {
            // @ts-ignore
            return (contract.abi.filter((method: { stateMutability: string; type: string; }) => method.stateMutability === "nonpayable" || method.stateMutability === "payable")
                .filter((method: { type: string; }) => method.type === "function") ?? [])
                .map((m: any) => ({ method: m as AbiFunction }));
        }
        return [];
    }, [contract, mode, contractAddress, effectiveUiMode, effectiveContractListId, contractListJson, abiFunctionMap]);

    useEffect(() => {
        if (undefined === props.tabId || 'new' === props.tabId) return;

        const tab = allTabs.filter((tab) => tab.id === props.tabId);
        if (tab.length > 0) {
            setTabInfo(tab[0]);
            setContractAddress(tab[0].contractAddress);
        } else {
            debugLog('flush')
            setTabInfo(undefined);
            setContractAddress(undefined);
        }
    }, [props.tabId, allTabs]);

    useEffect(() => {

        if (undefined === tabInfo) {
            debugLog('No tab found for given tabId.');
            return;
        }

        if (undefined === tabInfo.contractAddress || '' === tabInfo.contractAddress) {
            setContract(undefined);
            debugLog('No contract address found for given tab.');
            return;
        };

        const contract = findContract(tabInfo.contractAddress);

        if (undefined === contract) {
            debugLog('No contract found for given tab.');
            return;
        };


        if (contract[0] === tabInfo.contractAddress) {
            // update tab

            setContractAddress(contract[0]);
            setContract(contract[1]);

            const payloadLookup = {
                address: tabInfo.contractAddress,
                source: contract[1].metadataSource || MetadataSources.Sourcify,
                ...(contract[1].metadataSource === MetadataSources.Sourcify ? { chainId: contract[1].metadataAtChainId || userChainId } : {}),
                ...(contract[1].metadataSource === MetadataSources.BytecodeMetadata ? { rpcProvider: client as unknown as EthereumProvider } : {})
            }

            getMetadataFromAddress(payloadLookup).then((metadata) => {
                debugLog(metadata);
            }).catch((err) => {

            });
        }
    }, [tabInfo, findContract, client, userChainId]);

    function coerceArg(type: string, raw: string): any {
        const t = String(type || '').trim();
        if (t === 'bool' || t === 'boolean') {
            const v = String(raw || '').trim().toLowerCase();
            if (v === 'true' || v === '1') return true;
            if (v === 'false' || v === '0' || v === '') return false;
            return v === 'yes';
        }

        if (t.startsWith('uint') || t.startsWith('int')) {
            const v = String(raw || '').trim();
            if (v === '') return BigInt(0);
            try {
                return BigInt(v);
            } catch {
                return raw;
            }
        }

        // addresses/bytes/strings left as-is
        return raw;
    }

    function formatScalar(value: unknown): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'bigint') return value.toString();
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return safeStringify(value);
    }

    function formatResultMap(value: unknown): { [key: string]: string } {
        if (Array.isArray(value)) {
            const out: Record<string, string> = {};
            value.forEach((item, i) => {
                out[String(i)] = formatScalar(item);
            });
            return out;
        }

        if (value && typeof value === 'object') {
            const entries = Object.entries(value as Record<string, unknown>);
            const hasNamedKeys = entries.some(([k]) => Number.isNaN(Number(k)));
            const out: Record<string, string> = {};

            for (const [k, v] of entries) {
                if (hasNamedKeys && !Number.isNaN(Number(k))) continue;
                out[k] = formatScalar(v);
            }

            if (Object.keys(out).length > 0) return out;
            return { result: formatScalar(value) };
        }

        return { result: formatScalar(value) };
    }

    const handleContractExecute = async (
        method: AbiFunction,
        params: { [key: string]: any },
        stateSetCallback: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>,
        setErrorCallback: React.Dispatch<React.SetStateAction<string>>,
        setTxHash: React.Dispatch<React.SetStateAction<string | undefined>>,
        staticCall: boolean,
        options?: { [key: string]: string | number | bigint },
    ) => {
        // preserve ABI input order and coerce obvious primitives
        const callParams = (method.inputs || []).map((input) => {
            const name = (input as any).name as string;
            const raw = params[name];
            return coerceArg((input as any).type as string, raw);
        });

        const addr = contractAddress;
        if (!addr || !isAddress(addr)) {
            setErrorCallback('Invalid contract address');
            return;
        }
        const addressTyped = addr as Address;

        if (mode === "read") {
            debugLog(callParams)
            try {
                const results = await client.readContract({
                    // @ts-ignore
                    address: addressTyped,
                    abi: contract?.abi,
                    functionName: method.name,
                    args: callParams,
                    ...(options ? { ...options } : {})
                });

                debugLog(results);

                addRead(
                    contractAddress as string,
                    method.name,
                    wallet?.account.address || '',
                    callParams,
                );

                stateSetCallback(formatResultMap(results));
                return;
            } catch (err: any) {
                debugError(err);

                if (err && err.message) {
                    setErrorCallback(err?.message);
                } else {
                    setErrorCallback('Error while executing contract method. More details in console.');
                }
            }
        } else if (mode === "write") {
            if (!wallet) {
                setErrorCallback('Wallet is not connected');
                return;
            }

            try {
                const _paramsCall = {
                    address: addressTyped,
                    abi: contract?.abi,
                    functionName: method.name,
                    args: callParams,
                };

                setTxHash(undefined);


                const results = staticCall
                    ? await client.simulateContract({
                        // @ts-ignore
                        ..._paramsCall,
                        account: wallet.account,
                    })
                    : await wallet.writeContract(
                        // @ts-ignore
                        _paramsCall,
                    );

                setErrorCallback('');

                if (staticCall) {
                    const resultObj = results as SimulateContractReturnType;
                    stateSetCallback(formatResultMap((resultObj as any).result));
                } else {

                    addWrite(
                        contractAddress as string,
                        method.name,
                        wallet?.account.address || '',
                        callParams,
                        results as string
                    );


                    setTxHash(results as string);
                }

            } catch (err: any) {
                debugError(err);

                if (err && err.message) {
                    setErrorCallback(err?.message);
                } else {
                    setErrorCallback('Error while executing contract method. More details in console.');
                }
            }
        }
    }

    const [gridValue, setGridValue] = useState<number>(4);

    if (undefined === props.tabId || 'new' === props.tabId) return (<>
        <TabAdd />
    </>);

    return (
        <>
            <Box>
                {/* {props.tabId} */}
                <Grid container gap={0}>
                    <Grid item xs={gridValue}>
                        <ContractSelector setDynamicGrid={setGridValue} tabId={props.tabId} />
                    </Grid>
                    <Grid item xs={8} sx={{
                        display: 'flex',
                        justifyContent: 'flex-end'
                    }}>
                        <TabSettings tabId={props.tabId} />
                    </Grid>
                </Grid>

                <Divider sx={{
                    mt: 1,
                    mb: 1
                }} />

                <TabInfoBlock tabId={props.tabId} />


                <Divider sx={{
                    mt: 1,
                    mb: 1
                }} />

                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center'
                }}>

                    <TabModeSwitcher
                        tabId={props.tabId}
                        currentMode={mode}
                        isProxy={true}
                        onChangeMode={(mode) => setMode(mode)}
                    />



                </Box>

                {filteredMethods && filteredMethods.map((row, index: number) => {
                    const method = row.method;
                    return (<TabMethod
                        key={`method-${index}-${mode}-${contractAddress}`}
                        details={method as AbiFunction}
                        displayName={row.displayName}
                        contractListMeta={row.meta}
                        onCall={(
                            params,
                            stateSetCallback,
                            setErrorCallback,
                            setTxHash,
                            staticCall,
                            options
                        ) => {
                            handleContractExecute(
                                method,
                                params,
                                stateSetCallback,
                                setErrorCallback,
                                setTxHash,
                                staticCall,
                                options
                            );
                        }}
                    />)
                })}
            </Box>
        </>
    );
}