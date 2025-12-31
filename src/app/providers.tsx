'use client';

import * as React from 'react';
import {
    RainbowKitProvider,
    connectorsForWallets,
} from '@rainbow-me/rainbowkit';

import { createConfig, mainnet, WagmiConfig } from 'wagmi';
import {
    goerli,
    foundry,
} from 'wagmi/chains';
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import { Provider } from 'react-redux';
import { rollux } from '@/networks/rollux';
import store from '@/store';
import { ThemeProvider } from '@mui/material';
import theme from './theme';
import { NotificationProvider } from '@/components/Notifications';
import { createPublicClient, custom, http } from 'viem';
import type { Chain, EIP1193Provider } from 'viem';

// Extend Window interface for ethereum provider
declare global {
    interface Window {
        ethereum?: EIP1193Provider;
    }
}

// Define supported chains - wallet must be on one of these networks
const chains = [
    foundry,  // Anvil/localhost (chain ID 31337) - first for dev priority
    rollux,
    mainnet,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [goerli] : []),
] as const;

// Map chain IDs to chain configs for lookup
const chainById = new Map<number, Chain>(chains.map(c => [c.id, c as Chain]));

const demoAppInfo = {
    appName: 'DaoSYS test UI',
};

const connectors = connectorsForWallets([
    {
        groupName: 'Recommended',
        wallets: [
            injectedWallet({ chains: [...chains] }),
        ],
    },
]);

// Create a public client that uses the wallet's injected provider (window.ethereum)
// Falls back to the chain's default RPC only if no wallet is available
const getPublicClient = ({ chainId }: { chainId?: number }) => {
    const chain = chainId ? chainById.get(chainId) : chains[0];
    if (!chain) {
        throw new Error(`Unsupported chain: ${chainId}`);
    }

    // Use the wallet's injected provider if available
    if (typeof window !== 'undefined' && window.ethereum) {
        return createPublicClient({
            chain,
            transport: custom(window.ethereum),
        });
    }
    // Fallback for SSR or when no wallet is available
    return createPublicClient({
        chain,
        transport: http(),
    });
};

const wagmiConfig = createConfig({
    autoConnect: true,
    connectors,
    publicClient: getPublicClient,
});

export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    return (
        <Provider store={store}>
            <WagmiConfig config={wagmiConfig}>
                <ThemeProvider theme={theme}>
                    <NotificationProvider>
                        <RainbowKitProvider chains={[...chains]} appInfo={demoAppInfo}>
                            {mounted && children}
                        </RainbowKitProvider>
                    </NotificationProvider>
                </ThemeProvider>
            </WagmiConfig>
        </Provider>
    );
}