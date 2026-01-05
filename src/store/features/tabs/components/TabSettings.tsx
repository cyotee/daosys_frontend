import { debugLog } from "@/utils/debug";
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { Close, Settings } from '@mui/icons-material';
import { FormControl, IconButton, MenuItem, Popover, Select, TextField, Typography } from '@mui/material';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setTabTitle as reduxSetTabTitle, setTabUiMode as reduxSetTabUiMode, setTabContractListId as reduxSetTabContractListId } from '../tabsSlice';
import throttle from "lodash.throttle"
import { useContractLists } from '@/hooks/useContractLists';

export type TabSettingsProps = {
    tabId: string | undefined | number;

}

export const TabSettings: FC<TabSettingsProps> = (props: TabSettingsProps) => {

    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
        // props.setParentGrid(12);
    };

    const handleClose = () => {
        setAnchorEl(null);
        // props.setParentGrid(8);
    };

    const dispatch = useAppDispatch();

    const refInput = useRef<HTMLInputElement>(null);

    const tabTitle = useAppSelector(
        state => state.tabsSlice.tabs.find(tab => tab.id === props.tabId)?.title
    );

    const tabUiMode = useAppSelector(
        state => state.tabsSlice.tabs.find(tab => tab.id === props.tabId)?.uiMode
    );

    const tabContractListId = useAppSelector(
        state => state.tabsSlice.tabs.find(tab => tab.id === props.tabId)?.contractListId
    );

    const { index: contractListsIndex } = useContractLists();

    useEffect(() => {
        if (!tabTitle) return;
        if (!refInput.current) return;

        refInput.current.value = tabTitle;

    }, [tabTitle]);

    const throttledSetTabTitle = useMemo(
        () => throttle((name: string) => {
            dispatch(
                reduxSetTabTitle({
                    id: props.tabId,
                    title: name
                })
            );
        }, 100),
        [dispatch, props.tabId]
    );

    const setTabTitle = useCallback(throttledSetTabTitle, [throttledSetTabTitle]);

    const setTabUiMode = useCallback((uiMode: 'auto' | 'abi' | 'contractlist') => {
        dispatch(
            reduxSetTabUiMode({
                id: props.tabId,
                uiMode,
            })
        );
    }, [dispatch, props.tabId]);

    const setTabContractListId = useCallback((contractListId: string | undefined) => {
        dispatch(
            reduxSetTabContractListId({
                id: props.tabId,
                contractListId,
            })
        );
    }, [dispatch, props.tabId]);


    const open = Boolean(anchorEl);
    const id = open ? 'tab-settings-popover' : undefined;

    return (
        <>
            <IconButton
                sx={{
                    justifyContent: 'flex-end'
                }}
                onClick={handleClick}>
                {open ? <Close /> : <Settings />}
            </IconButton>
            <Popover

                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}

                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <Typography sx={{ p: 2 }}>Tab settings.</Typography>

                <TextField type='text' label="Change Tab Name" placeholder="Tab name" value={tabTitle || ''}
                    onChange={(e) => {
                        debugLog(e.target.value);
                        setTabTitle(e.target.value);
                    }}
                />

                <Typography sx={{ p: 2, pb: 1 }}>UI Source</Typography>
                <FormControl sx={{ p: 2, pt: 0, width: 320 }} size="small">
                    <Select
                        value={tabUiMode || 'auto'}
                        onChange={(e) => setTabUiMode(e.target.value as 'auto' | 'abi' | 'contractlist')}
                    >
                        <MenuItem value="auto">Auto (default)</MenuItem>
                        <MenuItem value="abi">ABI only</MenuItem>
                        <MenuItem value="contractlist">Contractlist</MenuItem>
                    </Select>
                </FormControl>

                <Typography sx={{ p: 2, pb: 1 }}>Contractlist</Typography>
                <FormControl sx={{ p: 2, pt: 0, width: 320 }} size="small">
                    <Select
                        value={tabContractListId || ''}
                        displayEmpty
                        onChange={(e) => setTabContractListId((e.target.value as string) || undefined)}
                    >
                        <MenuItem value="">(Auto select)</MenuItem>
                        {(contractListsIndex?.items || []).map((item) => (
                            <MenuItem key={item.id} value={item.id}>{item.id}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

            </Popover>
        </>
    )
}
