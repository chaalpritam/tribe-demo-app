"use client";

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { SOLANA_RPC_URL } from "@/lib/constants";
import { BrowserWalletAdapter } from "@/lib/browser-wallet/adapter";
import BrowserWalletSetup from "@/components/BrowserWalletSetup";

export default function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => SOLANA_RPC_URL, []);
  const wallets = useMemo(
    () => [
      new BrowserWalletAdapter(),
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
        <BrowserWalletSetup />
      </WalletProvider>
    </ConnectionProvider>
  );
}
