'use client'

import Box from '@/components/Box';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { useNotification } from '@/components/Notifications';
import { useLoadContract } from '@/hooks/useLoadContract';
import { useLocalAbis } from '@/hooks/useLocalAbis';
import { getDeploymentMode, getDeploymentModeLabel } from '@/utils/deploymentMode';
import { MetadataSources } from '@ethereum-sourcify/contract-call-decoder';
import { Chip, FormControl, Grid, InputLabel, MenuItem, TextField, Typography, Alert, Divider } from '@mui/material';
import type { Abi } from 'viem';
import { NextPage } from 'next';
import React, { useEffect, useState } from 'react';
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
        const getChainId = async () => {
            const chainId = await client.getChainId();
            setChainId(chainId);
        }

        getChainId();
    }, [client]);

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
                console.error('Invalid ABI JSON:', e);
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
                        setChainId(await client.getChainId() ?? 1);
                        setManualAbi('');
                        setContractName(undefined);
                        setLocalSelectedName(undefined);
                        resetState();
                    }}
                >
                    Load another contract
                </Button>
            </>}


        </Box >
    </>);
}

export default Page;
