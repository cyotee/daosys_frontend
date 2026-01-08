'use client'

import React, { FC, useState } from 'react';
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
import { Divider, Grid, Link, Menu, MenuItem, Stack, useMediaQuery, useTheme } from '@mui/material';
import Sidebar, { SidebarLink } from './Sidebar';
import { Collections, History, HomeMini, House, LinkOff, LinkOutlined, Send, Settings, SwapCalls } from '@mui/icons-material';
import { useAccount, useConnect, useDisconnect } from 'wagmi';


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

    const { address, isConnected } = useAccount();
    const { connect, connectors, isPending } = useConnect();
    const { disconnect } = useDisconnect();

    const [isSafeContext, setIsSafeContext] = React.useState(false);

    const [walletMenuAnchor, setWalletMenuAnchor] = React.useState<null | HTMLElement>(null);
    const walletMenuOpen = Boolean(walletMenuAnchor);

    React.useEffect(() => {
        try {
            const isIframe = window.self !== window.top;
            const safeDomainRegex = /(^|\.)safe\.global$/;

            let hasSafeReferrer = false;
            if (document.referrer) {
                try {
                    const referrerHost = new URL(document.referrer).hostname;
                    hasSafeReferrer = safeDomainRegex.test(referrerHost);
                } catch {
                    hasSafeReferrer = false;
                }
            }

            // Some browsers expose ancestorOrigins for embedded contexts.
            const ancestorOrigins = (window.location as unknown as { ancestorOrigins?: string[] }).ancestorOrigins;
            const hasSafeAncestorOrigin = Array.isArray(ancestorOrigins)
                ? ancestorOrigins.some((origin) => {
                    try {
                        return safeDomainRegex.test(new URL(origin).hostname);
                    } catch {
                        return false;
                    }
                })
                : false;

            setIsSafeContext(isIframe && (hasSafeReferrer || hasSafeAncestorOrigin));
        } catch {
            setIsSafeContext(false);
        }
    }, []);

    const availableConnectors = connectors
        .filter(Boolean)
        .filter((c) => c.id !== 'safe' || isSafeContext);
    const singleConnector = availableConnectors.length === 1 ? availableConnectors[0] : undefined;

    const theme = useTheme();
    const matches = useMediaQuery(theme.breakpoints.down('md'));

    const openWalletMenu = (e: React.MouseEvent<HTMLElement>) => {
        setWalletMenuAnchor(e.currentTarget);
    };

    const closeWalletMenu = () => {
        setWalletMenuAnchor(null);
    };

    const connectWith = (connector: (typeof availableConnectors)[number]) => {
        closeWalletMenu();
        connect({ connector });
    };

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

                    {isConnected ? (
                        <Button
                            onClick={() => disconnect()}
                            disabled={isPending}
                            variant="contained"
                            size="small"
                        >
                            {address ? `Disconnect (${address.slice(0, 6)}…${address.slice(-4)})` : 'Disconnect'}
                        </Button>
                    ) : (
                        <>
                            <Button
                                onClick={(e) => {
                                    if (singleConnector) connectWith(singleConnector);
                                    else openWalletMenu(e);
                                }}
                                disabled={availableConnectors.length === 0 || isPending}
                                variant="contained"
                                size="small"
                            >
                                Connect Wallet
                            </Button>
                            <Menu
                                anchorEl={walletMenuAnchor}
                                open={walletMenuOpen}
                                onClose={closeWalletMenu}
                                keepMounted
                            >
                                {availableConnectors.map((connector) => (
                                    <MenuItem
                                        key={connector.id}
                                        onClick={() => connectWith(connector)}
                                        disabled={isPending}
                                    >
                                        {connector.name}
                                    </MenuItem>
                                ))}
                            </Menu>
                        </>
                    )}

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