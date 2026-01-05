import { Button, Grid, Table, TableBody, TableCell, TableRow, Typography } from "@mui/material";
import React, { FC, useState, useEffect, useCallback } from "react";
import { Transaction, TransactionReceipt, decodeEventLog } from "viem";
import { usePublicClient, useWaitForTransaction } from "wagmi";
import { Box } from "@/components/Box";
import { Box as MBox } from "@mui/material";
import useSelectedTab from "../../userPreferences/hooks/useSelectedTab";
import { useSelectedContract } from "../../contracts/hooks/useSelectedContract";
import { CheckCircle, Info } from "@mui/icons-material";
import { debugLog } from "@/utils/debug";

export type TabMethodEventsProps = {
    txHash: string;
}

const TableItem: FC<{ label: string, value: string | bigint | number }> = ({ label, value }) => {


    return (<>
        <TableRow>
            <TableCell>{label}</TableCell>
            <TableCell sx={{
                wordBreak: 'break-all'
            }}>{value.toString()}</TableCell>
        </TableRow>
    </>)
}

const TableItemArray: FC<{ label: string, value: {} | readonly [] }> = ({ label, value }) => {
    return (<>

        <TableRow>
            <TableCell>{label}</TableCell>
            <TableCell sx={{
                wordBreak: 'break-all'
            }}>
                {Array.isArray(value) && value.length === 0 && <Typography variant="body2">No events</Typography>
                }
                {Array.isArray(value) && value.map((item: any, index) => {
                    return (<>
                        <Typography key={`${label}-${index}`} variant="body2">{item.toString()}</Typography>
                    </>)
                })}

                {!Array.isArray(value) && Object.keys(value).length === 0 && <Typography variant="body2">No events</Typography>}

                {!Array.isArray(value) && Object.keys(value).map((key, index) => {
                    // @ts-ignore
                    const item = value[key];

                    return (<>
                        <Typography key={`${label}-${index}`} variant="body2">{key}: {item.toString()}</Typography>
                    </>)
                })}
            </TableCell>
        </TableRow>
    </>
    );
}




export const TabMethodEvents: FC<TabMethodEventsProps> = ({ txHash }) => {

    const [showDetails, setShowDetails] = useState<boolean>(false);

    const {
        selectedContract,
        selectedContractABI
    } = useSelectedContract();

    const [decodedData, setDecodedData] = useState<{ [key: string]: readonly [] | {} }>({});

    const { data, isFetched, isError } = useWaitForTransaction({
        // @ts-ignore
        hash: txHash,
    });

    useEffect(() => {
        debugLog(data, selectedContractABI);

        if (data?.logs && selectedContractABI) {
            const decodedData: { [key: string]: readonly [] | {} } = {};



            data.logs.forEach((log) => {
                const decoded = decodeEventLog({
                    abi: selectedContractABI,
                    data: log.data,
                    topics: log.topics,
                    strict: false,
                });

                decodedData[decoded.eventName] = decoded.args;
            })

            setDecodedData(decodedData);
        }
    }, [data, isFetched, selectedContractABI]);


    if (!isFetched) {

        return (<>
            <Box sx={{
                mt: 5
            }}>

                <Typography variant="h6">Waiting for transaction confirmation</Typography>
            </Box>
        </>);
    }


    if (showDetails) {
        return (<>
            <Box sx={{
                mt: 5
            }}>
                <Grid container>
                    <Grid item xs={8}>
                        <Typography variant="h6">Transaction Details</Typography>
                    </Grid>
                    <Grid item xs={4} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button variant={'contained'} color={'info'} onClick={() => setShowDetails(false)}>
                            Close
                        </Button>
                    </Grid>
                </Grid>
                <Table>
                    <TableBody>
                        <TableItem
                            label="Block Hash"
                            value={data?.blockHash ?? ''}
                        />

                        <TableItem
                            label="Block Number"
                            value={data?.blockNumber ?? ''}
                        />

                        <TableItem
                            label="Contract Address"
                            value={data?.to ?? ''}

                        />

                        <TableItem
                            label="Cumulative Gas Used"
                            value={data?.cumulativeGasUsed ?? ''}
                        />

                        <TableItem
                            label="L1 Fee"
                            // @ts-ignore
                            value={(data?.l1Fee && data?.l1FeeScalar) ? `${data.l1Fee} - ${data.l1FeeScalar}` : ''}
                        />


                        {data?.logs && <>
                            <TableRow>
                                <TableCell colSpan={2}>
                                    <Typography variant="h6" textAlign={'center'}>
                                        Events
                                    </Typography>
                                </TableCell>
                            </TableRow>

                            {Object.keys(decodedData).map((key, index) => {
                                const value = decodedData[key];

                                return (
                                    <TableItemArray key={`table-item-array-renderer-${index}-${selectedContract}`} label={key} value={value} />
                                )
                            })}
                        </>}

                    </TableBody>
                </Table>

            </Box>
        </>)
    }

    return (<>
        <Box sx={{
            mt: 5
        }}>
            <Grid container>
                <Grid item xs={8}>
                    <Typography variant="h6">
                        <MBox component="span" display="flex" alignItems="center">
                            <CheckCircle color="success" style={{ marginRight: '8px' }} />
                            Transaction Details
                        </MBox>
                    </Typography>
                </Grid>
                <Grid item xs={4} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant={'contained'} color={'success'} onClick={() => setShowDetails(true)}>
                        Show Details
                    </Button>
                </Grid>
            </Grid>
        </Box>
    </>);
}

export default TabMethodEvents