'use client';

import * as React from 'react';

import { createConfig, WagmiProvider } from 'wagmi';
import { coinbaseWallet, injected, safe } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    goerli,
    foundry,
    mainnet,
} from 'wagmi/chains';
import { Provider } from 'react-redux';
import { rollux } from '@/networks/rollux';
import store from '@/store';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from './theme';
import { NotificationProvider } from '@/components/Notifications';
import { http } from 'viem';

// Define supported chains - wallet must be on one of these networks
const chains = [
    foundry,  // Anvil/localhost (chain ID 31337) - first for dev priority
    rollux,
    mainnet,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [goerli] : []),
] as const;

const connectors = [
    injected(),
    coinbaseWallet({ appName: 'DaoSYS UI' }),
    safe({ shimDisconnect: true }),
];

type ChainId = (typeof chains)[number]['id'];

const transports = Object.fromEntries(
    chains.map((c) => [c.id, http(c.rpcUrls.default.http[0])])
) as Record<ChainId, ReturnType<typeof http>>;

const wagmiConfig = createConfig({
    connectors,
    chains,
    ssr: true,
    transports,
});

export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = React.useState(false);
    const [queryClient] = React.useState(() => new QueryClient());
    React.useEffect(() => setMounted(true), []);
    return (
        <Provider store={store}>
            <WagmiProvider config={wagmiConfig}>
                <QueryClientProvider client={queryClient}>
                    <ThemeProvider theme={theme}>
                        <CssBaseline />
                        <NotificationProvider>
                            {mounted && children}
                        </NotificationProvider>
                    </ThemeProvider>
                </QueryClientProvider>
            </WagmiProvider>
        </Provider>
    );
}
