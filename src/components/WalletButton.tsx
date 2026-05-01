"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useState, useEffect } from "react";
import { BROWSER_WALLET_NAME, BROWSER_WALLET_SETUP_REQUIRED } from "@/lib/browser-wallet/adapter";
import { hasStoredKeypair } from "@/lib/browser-wallet/keypair-store";

interface WalletButtonProps {
  className?: string;
  label?: string;
}

export default function WalletButton({ className = "", label }: WalletButtonProps) {
  const { select, connect, disconnect, publicKey, connected, connecting, wallet } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  // Auto-connect for returning users if they already have a keypair
  useEffect(() => {
    if (!connected && !connecting && hasStoredKeypair()) {
      // If we previously selected Browser Wallet, it will be in state
      if (wallet?.adapter.name === BROWSER_WALLET_NAME) {
        connect().catch(() => {});
      } else {
        // Force selection if it's the only wallet
        select(BROWSER_WALLET_NAME);
      }
    }
  }, [connected, connecting, wallet, select, connect]);

  const handleConnect = useCallback(async () => {
    try {
      // 1. Ensure it's selected
      select(BROWSER_WALLET_NAME);
      
      // 2. Check if we have a local keypair
      if (!hasStoredKeypair()) {
        window.dispatchEvent(new Event(BROWSER_WALLET_SETUP_REQUIRED));
        return;
      }

      // 3. Connect (the useEffect above might also handle this, but explicit is better)
      await connect();
    } catch (error) {
      console.error("Connection failed", error);
    }
  }, [select, connect]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setShowDropdown(false);
  }, [disconnect]);

  if (connected && publicKey) {
    const base58 = publicKey.toBase58();
    const addressShort = `${base58.slice(0, 4)}...${base58.slice(-4)}`;

    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors ${className}`}
        >
          <div className="h-2 w-2 rounded-full bg-green-500" />
          {addressShort}
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
            <button
              onClick={() => {
                navigator.clipboard.writeText(base58);
                setShowDropdown(false);
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Copy Address
            </button>
            <button
              onClick={handleDisconnect}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className={`rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-50 ${className}`}
    >
      {connecting ? "Connecting..." : (label || "Get Started")}
    </button>
  );
}
