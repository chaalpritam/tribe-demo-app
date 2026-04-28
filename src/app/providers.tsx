"use client";

import React, { useEffect, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { SOLANA_RPC_URL } from "@/lib/constants";
import {
  BROWSER_WALLET_READY,
  BrowserWalletAdapter,
} from "@/lib/browser-wallet/adapter";
import BrowserWalletSetup from "@/components/BrowserWalletSetup";

import "@solana/wallet-adapter-react-ui/styles.css";

export default function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => SOLANA_RPC_URL, []);
  const browserWallet = useMemo(() => new BrowserWalletAdapter(), []);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      browserWallet,
    ],
    [browserWallet],
  );

  // The setup modal saves the keypair, then dispatches BROWSER_WALLET_READY.
  // Re-evaluate the adapter's readyState so the wallet modal flips it to
  // "Installed" and the standard select+connect flow proceeds.
  useEffect(() => {
    const handler = () => browserWallet.refreshReadyState();
    window.addEventListener(BROWSER_WALLET_READY, handler);
    return () => window.removeEventListener(BROWSER_WALLET_READY, handler);
  }, [browserWallet]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
          <BrowserWalletSetup />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
