'use client'

import Box from '@/components/Box';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { useLoadContract } from '@/hooks/useLoadContract';
import { listLocalAbis } from '@/hooks/useLocalAbis';
import { MetadataSources } from '@ethereum-sourcify/contract-call-decoder';
import { Badge, Chip, FormControl, Grid, Input, InputLabel, MenuItem, TextField, TextareaAutosize, Typography } from '@mui/material';
import { NextPage } from 'next';
import React, { FC, useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';


const Page: NextPage = () => {
    const [address, setAddress] = useState<string>('')
    const [chainId, setChainId] = useState<number>(0)
    const [manualAbi, setManualAbi] = useState<string>('')
    const [contractName, setContractName] = useState<string | undefined>(undefined);
    const {
        loadContractMetadata,
        loadingState,
        loadContract,
        loadLocalAbi,
        resetState
    } = useLoadContract(address, contractName);

    const client = usePublicClient();

    useEffect(() => {
        const getChainId = async () => {
            const chainId = await client.getChainId();
            setChainId(chainId);
        }

        getChainId();
    }, [client]);

    const [metadataSource, setMetadataSource] = useState<number | string>('');

    // local ABI listing
    const [localAbiNames, setLocalAbiNames] = useState<string[]>([]);
    const [localListLoading, setLocalListLoading] = useState(false);
    const [localListError, setLocalListError] = useState<string | null>(null);
    const [localSelectedName, setLocalSelectedName] = useState<string | undefined>(undefined);

    const handleLoad = async () => {
        if (loadingState === 'metadata-not-found') {

            const finalAbiArr = Array.isArray(manualAbi) ? manualAbi : JSON.parse(manualAbi);

            loadContract(address, finalAbiArr);
        } else {
            loadContractMetadata(metadataSource as unknown as MetadataSources, chainId);
        }
    }

    const handleListLocal = async () => {
        setLocalListError(null);
        setLocalListLoading(true);
        try {
            const res = await listLocalAbis();
            if (res && res.names) {
                setLocalAbiNames(res.names as string[]);
            } else if (res && res.artifacts) {
                setLocalAbiNames((res.artifacts as any[]).map(a => a.name));
            } else {
                setLocalListError('No local ABIs found');
            }
        } catch (e: any) {
            setLocalListError(e?.message || 'Failed to list local ABIs');
        }
        setLocalListLoading(false);
    }

    const handleLoadLocal = async () => {
        if (!localSelectedName) return;
        await loadLocalAbi(address, localSelectedName);
    }





    return (<>
        <Box>
            <Typography variant='h5'>
                Connect Contract - <Chip label={loadingState} />
            </Typography>
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

            <Grid container spacing={2}>
                <Grid xs={4} item>
                    <FormControl fullWidth sx={{ mt: 3 }}>
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
                    <FormControl fullWidth sx={{ mt: 3 }}>
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
                    <FormControl fullWidth sx={{ mt: 3 }}>
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
                    <TextField
                        multiline
                        rows={5}
                        sx={{ mt: 3 }}
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


            {/* Local ABI loader UI */}
            <Box sx={{ mt: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                        <Button neon fullWidth onClick={handleListLocal} disabled={address === '' || localListLoading}>
                            {localListLoading ? 'Listing...' : 'List Local ABIs'}
                        </Button>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        {localListError && <Typography color="error">{localListError}</Typography>}
                    </Grid>

                    {localAbiNames.length > 0 && (
                        <>
                            <Grid item xs={12} sm={8}>
                                <FormControl fullWidth sx={{ mt: 1 }}>
                                    <InputLabel id="local-abi-label">Local ABI</InputLabel>
                                    <Select
                                        labelId="local-abi-label"
                                        id="local-abi-select"
                                        value={localSelectedName || ''}
                                        onChange={(e) => setLocalSelectedName(e.target.value as string)}
                                        label="Local ABI"
                                    >
                                        <MenuItem value="" disabled>Select local ABI</MenuItem>
                                        {localAbiNames.map((name) => (
                                            <MenuItem key={name} value={name}>{name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Button neon fullWidth sx={{ mt: 1 }} disabled={!localSelectedName || address === ''} onClick={handleLoadLocal}>
                                    Load Local ABI
                                </Button>
                            </Grid>
                        </>
                    )}
                </Grid>
            </Box>

            {loadingState !== 'contract-loaded' && <>
                <Button neon fullWidth sx={{ mt: 3, background: 'primary.main', color: 'white' }}
                    disabled={address === ''}
                    onClick={handleLoad}
                >
                    {(loadingState === 'none' || loadingState === 'invalid-address') ? 'Connect' :
                        loadingState === 'metadata-not-found' ? 'Load ABI' : 'Loading...'
                    }
                </Button>
            </>}


            {loadingState === 'contract-loaded' && <>
                <Typography variant='h5' sx={{ mt: 3 }}>
                    Contract loaded
                </Typography>
                <Typography variant='body1' sx={{ mt: 3 }}>
                    You can use it in the workspace.
                </Typography>

                <Button neon fullWidth sx={{ mt: 3, background: 'primary.main', color: 'white' }}
                    onClick={async () => {
                        setAddress('');
                        setMetadataSource('');
                        setChainId(await client.getChainId() ?? 1);
                        setManualAbi('');
                        setContractName(undefined);
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