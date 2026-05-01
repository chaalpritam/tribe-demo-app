"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useState } from "react";
import { BROWSER_WALLET_NAME } from "@/lib/browser-wallet/adapter";

interface WalletButtonProps {
  className?: string;
}

export default function WalletButton({ className = "" }: WalletButtonProps) {
  const { select, connect, disconnect, publicKey, connected, connecting } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleConnect = useCallback(async () => {
    try {
      select(BROWSER_WALLET_NAME);
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
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
