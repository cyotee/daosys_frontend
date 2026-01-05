'use client'

import React, { FC, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Container from '@mui/material/Container';
import MenuIcon from '@mui/icons-material/Menu';
import AppBar from '@/components/AppBar';
import Button from '@/components/Button';
import Select from '@/components/Select';
import { useSelectedCollection } from '@/store/features/userPreferences/hooks/useSelectedCollection'
import { Divider, Grid, Link, Stack, useMediaQuery, useTheme } from '@mui/material';
import Sidebar, { SidebarLink } from './Sidebar';
import { Collections, History, HomeMini, House, LinkOff, LinkOutlined, Send, Settings, SwapCalls } from '@mui/icons-material';


const sidebarLinks: SidebarLink[] = [
    {
        name: 'Home',
        path: '/',
        icon: <House />,
    },
    {
        name: 'Deploy Contract',
        path: '/deploy',
        icon: <Send />,
    },
    {
        name: 'Connect Contract',
        path: '/connectContract',
        icon: <LinkOutlined />,
    },
    {
        name: 'Collections',
        path: '/collections',
        icon: <Collections />,
    },
    {
        name: 'History',
        path: '/history',
        icon: <History />,
    },
    {
        name: 'Import / Export data',
        path: '/import-export',
        icon: <SwapCalls />,
    },
    {
        name: 'Settings',
        path: '/settings',
        icon: <Settings />,
    }
]

export const Wrapper: FC<{ children: React.ReactNode }> = ({ children }) => {
    const { selectedCollection } = useSelectedCollection();

    const theme = useTheme();
    const matches = useMediaQuery(theme.breakpoints.down('md'));

    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar position="fixed" open={true}>
                <Toolbar>


                    <Typography
                        component="h6"
                        variant="h6"
                        color="inherit"
                        noWrap
                        sx={{ flexGrow: 1 }}
                    >
                        DaoSYS UI
                    </Typography>


                    <ConnectButton />

                </Toolbar>
            </AppBar>

            <Box
                component="main"
                sx={{
                    backgroundColor: (theme) => theme.palette.background.default,
                    boxShadow: (theme) => theme.shadows[1],
                    flexGrow: 1,
                    height: '100vh',
                    overflow: 'auto',
                }}
            >
                <Toolbar />
                <Container maxWidth={'lg'} sx={{ mt: 4, mb: 4 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={matches ? 12 : 3}>
                            <Sidebar
                                links={sidebarLinks}
                            />
                        </Grid>
                        <Grid item xs={matches ? 12 : 9}>
                            {children}
                        </Grid>
                    </Grid>

                </Container>
            </Box>
        </Box>
    );
}