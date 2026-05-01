"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "./WalletButton";
import { STORAGE_KEYS } from "@/lib/constants";
import { BROWSER_WALLET_NAME } from "@/lib/browser-wallet/adapter";
import { useEffect, useState } from "react";

interface ConnectionRequiredProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function ConnectionRequired({
  children,
  title = "Authentication Required",
  description = "Connect your wallet to access this page",
}: ConnectionRequiredProps) {
  const { connected, connecting, select, connect, wallet } = useWallet();
  const [hasExistingAccount, setHasExistingAccount] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    const exists = !!localStorage.getItem(STORAGE_KEYS.tid);
    setHasExistingAccount(exists);
    
    // Proactively trigger selection if we have an account but no wallet selected
    if (exists && !connected && !connecting && !hasAttempted && !connectionError) {
      if (!wallet || wallet.adapter.name !== BROWSER_WALLET_NAME) {
        setHasAttempted(true);
        select(BROWSER_WALLET_NAME);
      }
      
      // If after 3 seconds we are still not connected, assume connection failed
      // (e.g. keypair missing from backup)
      const timeout = setTimeout(() => {
        if (!connected) {
          setConnectionError(true);
        }
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [connected, connecting, select, wallet, hasAttempted, connectionError]);

  if (connected) {
    return <>{children}</>;
  }

  // If we are actively connecting, or we haven't failed the auto-connect yet
  if (connecting || (hasExistingAccount && !connectionError)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-900 border-t-transparent" />
        <h2 className="mt-6 text-xl font-bold text-gray-900">
          Connecting...
        </h2>
        <p className="mt-2 text-gray-500">Restoring your session</p>
        
        {/* If it takes too long, give a visible way out */}
        <div className="mt-10 animate-pulse">
          <button 
            onClick={() => setConnectionError(true)}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Taking too long? Click here.
          </button>
        </div>
      </div>
    );
  }

  // Fallback / Initial state
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-900 text-3xl font-bold text-white">
        T
      </div>
      <h1 className="mt-6 text-3xl font-bold text-gray-900">{title}</h1>
      <p className="mt-3 max-w-md text-lg text-gray-600">{description}</p>
      <div className="mt-8 flex flex-col items-center gap-4">
        <WalletButton className="h-11 px-8 text-base" label="Connect Wallet" />
        
        {hasExistingAccount && (
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Clear local data and start over
          </button>
        )}
      </div>
    </div>
  );
}
