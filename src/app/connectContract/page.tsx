'use client'

import Box from '@/components/Box';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { useNotification } from '@/components/Notifications';
import { useLoadContract } from '@/hooks/useLoadContract';
import { useLocalAbis } from '@/hooks/useLocalAbis';
import { useProxyDetection } from '@/hooks/useProxyDetection';
import { getDeploymentMode, getDeploymentModeLabel } from '@/utils/deploymentMode';
import { debugError } from '@/utils/debug';
import { getProxyTypeLabel } from '@/utils/proxyDetection';
import { MetadataSources } from '@ethereum-sourcify/contract-call-decoder';
import { Chip, FormControl, Grid, InputLabel, MenuItem, TextField, Typography, Alert, Divider, CircularProgress } from '@mui/material';
import type { Abi } from 'viem';
import { isAddress } from 'viem';
import { NextPage } from 'next';
import React, { useEffect, useState, useCallback } from 'react';
import { usePublicClient } from 'wagmi';


const Page: NextPage = () => {
    const [address, setAddress] = useState<string>('')
    const [chainId, setChainId] = useState<number>(0)
    const [manualAbi, setManualAbi] = useState<string>('')
    const [contractName, setContractName] = useState<string | undefined>(undefined);
    const { notifySuccess, notifyError, notifyWarning } = useNotification();
    const {
        loadContractMetadata,
        loadingState,
        loadContract,
        loadLocalAbi,
        resetState
    } = useLoadContract(address, contractName);

    const client = usePublicClient();

    // Proxy detection
    const {
        proxyInfo,
        detectionState,
        detect: detectProxy,
        reset: resetProxyDetection
    } = useProxyDetection();

    // Local ABIs hook
    const {
        hasAbis: hasLocalAbis,
        contractNames: localAbiNames,
        loading: localAbisLoading,
        projectType,
        projectDir
    } = useLocalAbis();

    const [localSelectedName, setLocalSelectedName] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!client) return;

        const getChainId = async () => {
            const chainId = await client.getChainId();
            setChainId(chainId);
        }

        getChainId();
    }, [client]);

    // Detect proxy when address changes
    useEffect(() => {
        if (address && isAddress(address)) {
            detectProxy(address);
        } else {
            resetProxyDetection();
        }
    }, [address, detectProxy, resetProxyDetection]);

    const [metadataSource, setMetadataSource] = useState<number | string>('');
    const deploymentMode = getDeploymentMode();
    const [prevLoadingState, setPrevLoadingState] = useState(loadingState);

    // Watch for loading state changes to show notifications
    useEffect(() => {
        if (prevLoadingState !== loadingState) {
            if (loadingState === 'metadata-not-found' && prevLoadingState === 'loading-metadata') {
                notifyWarning('Metadata not found. You can paste the ABI manually.');
            } else if (loadingState === 'contract-loaded' && prevLoadingState !== 'contract-loaded') {
                // Only notify if we didn't already notify (from handleLoad/handleLoadLocal)
                if (prevLoadingState === 'loading-abi' || prevLoadingState === 'loading-contract') {
                    notifySuccess('Contract loaded successfully!');
                }
            } else if (loadingState === 'contract-error') {
                notifyError('Failed to load contract. Please try again.');
            } else if (loadingState === 'abi-error') {
                notifyError('Failed to load ABI. Please check the contract name.');
            }
            setPrevLoadingState(loadingState);
        }
    }, [loadingState, prevLoadingState, notifySuccess, notifyError, notifyWarning]);

    const handleLoad = async () => {
        if (loadingState === 'metadata-not-found') {
            try {
                const parsedAbi = JSON.parse(manualAbi) as Abi;
                const result = await loadContract(address, parsedAbi);
                if (result) {
                    notifySuccess('Contract loaded successfully!');
                } else {
                    notifyError('Failed to load contract');
                }
            } catch (e) {
                debugError('Invalid ABI JSON:', e);
                notifyError('Invalid ABI JSON format. Please check your input.');
            }
        } else {
            await loadContractMetadata(metadataSource as unknown as MetadataSources, chainId);
        }
    }

    const handleLoadLocal = async () => {
        if (!localSelectedName) return;
        const result = await loadLocalAbi(address, localSelectedName);
        if (result) {
            notifySuccess(`Loaded ${localSelectedName} successfully!`);
        } else {
            notifyError(`Failed to load ${localSelectedName}. Check if the ABI exists.`);
        }
    }

    const handleLoadImplementation = useCallback(() => {
        if (proxyInfo?.implementationAddress) {
            setAddress(proxyInfo.implementationAddress);
            resetState();
            notifySuccess('Switched to implementation address. You can now load its ABI.');
        }
    }, [proxyInfo, resetState, notifySuccess]);

    return (<>
        <Box>
            <Typography variant='h5'>
                Connect Contract - <Chip label={loadingState} />
            </Typography>
            {deploymentMode === 'local' && (
                <Typography variant='caption' color='text.secondary'>
                    Mode: {getDeploymentModeLabel()}
                    {projectType && ` | ${projectType.charAt(0).toUpperCase() + projectType.slice(1)} project`}
                </Typography>
            )}
        </Box>

        <Box mt={3}>
            <FormControl fullWidth>
                <TextField
                    onChange={(e) => setAddress(e.target.value)}
                    value={address}
                    id="outlined-basic"
                    label="Contract Address"
                    variant="outlined"
                    fullWidth
                />
            </FormControl>

            {/* Proxy Detection Section */}
            {detectionState === 'detecting' && (
                <Alert severity="info" sx={{ mt: 2 }} icon={<CircularProgress size={20} />}>
                    Detecting proxy pattern...
                </Alert>
            )}

            {detectionState === 'detected' && proxyInfo?.isProxy && (
                <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'warning.main', borderRadius: 1, bgcolor: 'warning.dark', opacity: 0.9 }}>
                    <Typography variant='subtitle2' color='warning.contrastText' gutterBottom>
                        🔗 Proxy Contract Detected
                    </Typography>
                    <Grid container spacing={1}>
                        <Grid item xs={12}>
                            <Chip
                                label={getProxyTypeLabel(proxyInfo.proxyType)}
                                color="warning"
                                size="small"
                            />
                        </Grid>
                        {proxyInfo.implementationAddress && (
                            <Grid item xs={12}>
                                <Typography variant='body2' color='warning.contrastText'>
                                    Implementation: <code style={{ fontSize: '0.85em' }}>{proxyInfo.implementationAddress}</code>
                                </Typography>
                            </Grid>
                        )}
                        {proxyInfo.beaconAddress && (
                            <Grid item xs={12}>
                                <Typography variant='body2' color='warning.contrastText'>
                                    Beacon: <code style={{ fontSize: '0.85em' }}>{proxyInfo.beaconAddress}</code>
                                </Typography>
                            </Grid>
                        )}
                        {proxyInfo.adminAddress && (
                            <Grid item xs={12}>
                                <Typography variant='body2' color='warning.contrastText'>
                                    Admin: <code style={{ fontSize: '0.85em' }}>{proxyInfo.adminAddress}</code>
                                </Typography>
                            </Grid>
                        )}
                        {proxyInfo.facetAddresses && proxyInfo.facetAddresses.length > 0 && (
                            <Grid item xs={12}>
                                <Typography variant='body2' color='warning.contrastText' gutterBottom>
                                    Diamond Facets ({proxyInfo.facetAddresses.length}):
                                </Typography>
                                <Box sx={{ maxHeight: 150, overflow: 'auto', pl: 1 }}>
                                    {proxyInfo.facetAddresses.map((facet, idx) => (
                                        <Typography key={facet} variant='caption' color='warning.contrastText' component='div'>
                                            {idx + 1}. <code style={{ fontSize: '0.85em' }}>{facet}</code>
                                        </Typography>
                                    ))}
                                </Box>
                            </Grid>
                        )}
                        {proxyInfo.implementationAddress && proxyInfo.proxyType !== 'EIP-2535' && proxyInfo.proxyType !== 'ERC-8109' && (
                            <Grid item xs={12} sx={{ mt: 1 }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={handleLoadImplementation}
                                    sx={{ borderColor: 'warning.contrastText', color: 'warning.contrastText' }}
                                >
                                    Load Implementation Contract
                                </Button>
                            </Grid>
                        )}
                    </Grid>
                </Box>
            )}

            {detectionState === 'detected' && !proxyInfo?.isProxy && address && isAddress(address) && (
                <Alert severity="success" sx={{ mt: 2 }}>
                    Not a proxy contract - you can load the ABI directly.
                </Alert>
            )}

            {/* Local ABI Section - shown when local ABIs are available */}
            {hasLocalAbis && (
                <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant='subtitle2' color='primary' gutterBottom>
                        Local Artifacts ({localAbiNames.length} contracts)
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={8}>
                            <FormControl fullWidth>
                                <InputLabel id="local-abi-label">Select Contract</InputLabel>
                                <Select
                                    labelId="local-abi-label"
                                    id="local-abi-select"
                                    value={localSelectedName || ''}
                                    onChange={(e) => setLocalSelectedName(e.target.value as string)}
                                    label="Select Contract"
                                >
                                    <MenuItem value="" disabled>Select a contract</MenuItem>
                                    {localAbiNames.map((name) => (
                                        <MenuItem key={name} value={name}>{name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <Button
                                neon
                                fullWidth
                                disabled={!localSelectedName || address === ''}
                                onClick={handleLoadLocal}
                            >
                                Load Local ABI
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            )}

            {/* Loading state for local ABIs */}
            {localAbisLoading && (
                <Alert severity="info" sx={{ mt: 2 }}>
                    Loading local contract artifacts...
                </Alert>
            )}

            <Divider sx={{ my: 3 }} />

            {/* On-chain metadata section */}
            <Typography variant='subtitle2' color='text.secondary' gutterBottom>
                Or load from on-chain metadata
            </Typography>

            <Grid container spacing={2}>
                <Grid xs={4} item>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <InputLabel id="metadata-source-label">Metadata source</InputLabel>
                        <Select fullWidth
                            labelId='metadata-source-label'
                            onChange={(e) => setMetadataSource(parseInt(e.target.value as string))}
                            id='metadata-source'
                            value={metadataSource}
                            label='Metadata source'

                        >
                            <MenuItem value="" defaultChecked disabled>Select metadata source</MenuItem>
                            <MenuItem value="0">Sourcify</MenuItem>
                            <MenuItem value="1">Bytecode</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid xs={4} item>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <TextField
                            onChange={(e) => setChainId(isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value))}
                            value={chainId}
                            id="chain-id"
                            label="Chain ID"
                            variant="outlined"
                            fullWidth
                        />
                    </FormControl>
                </Grid>
                <Grid xs={4} item>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <TextField
                            onChange={(e) => setContractName(e.target.value.length > 0 ? e.target.value : undefined)}
                            value={contractName || ''}
                            id="contract-name"
                            label="Contract Name"
                            variant="outlined"
                            fullWidth
                        />
                    </FormControl>
                </Grid>
            </Grid>

            {loadingState === 'metadata-not-found' &&
                (<>
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        Metadata not found. You can paste the ABI manually below.
                    </Alert>
                    <TextField
                        multiline
                        rows={5}
                        sx={{ mt: 2 }}
                        id="outlined-basic"
                        label="Paste ABI"
                        variant="outlined"
                        onChange={(e) => {
                            setManualAbi(e.target.value);
                        }}
                        fullWidth
                    />
                </>)
            }

            {loadingState !== 'contract-loaded' && <>
                <Button neon fullWidth sx={{ mt: 3, background: 'primary.main', color: 'white' }}
                    disabled={address === ''}
                    onClick={handleLoad}
                >
                    {(loadingState === 'none' || loadingState === 'invalid-address') ? 'Connect via Metadata' :
                        loadingState === 'metadata-not-found' ? 'Load ABI' : 'Loading...'
                    }
                </Button>
            </>}


            {loadingState === 'contract-loaded' && <>
                <Alert severity="success" sx={{ mt: 3 }}>
                    Contract loaded successfully! You can use it in the workspace.
                </Alert>

                <Button neon fullWidth sx={{ mt: 3, background: 'primary.main', color: 'white' }}
                    onClick={async () => {
                        setAddress('');
                        setMetadataSource('');
                        setChainId(client ? await client.getChainId() : 1);
                        setManualAbi('');
                        setContractName(undefined);
                        setLocalSelectedName(undefined);
                        resetState();
                        resetProxyDetection();
                    }}
                >
                    Load another contract
                </Button>
            </>}


        </Box >
    </>);
}

export default Page;
