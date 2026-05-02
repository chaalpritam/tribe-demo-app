"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BROWSER_WALLET_NAME, BROWSER_WALLET_SETUP_REQUIRED } from "@/lib/browser-wallet/adapter";
import { hasStoredKeypair } from "@/lib/browser-wallet/keypair-store";
import { useSignOut } from "@/lib/auth";

interface WalletButtonProps {
  className?: string;
  label?: string;
}

export default function WalletButton({ className = "", label }: WalletButtonProps) {
  const { select, connect, publicKey, connected, connecting } = useWallet();
  const signOut = useSignOut();
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleConnect = useCallback(async () => {
    try {
      select(BROWSER_WALLET_NAME);
      if (!hasStoredKeypair()) {
        window.dispatchEvent(new Event(BROWSER_WALLET_SETUP_REQUIRED));
        return;
      }
      await connect();
    } catch (error) {
      console.error("Connection failed", error);
    }
  }, [select, connect]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  if (connected && publicKey) {
    const base58 = publicKey.toBase58();
    const addressShort = `${base58.slice(0, 4)}...${base58.slice(-4)}`;

    return (
      <div className="relative" ref={containerRef}>
        <div
          className={`flex items-center gap-2 rounded-lg bg-gray-900 pl-4 pr-2 py-2 text-sm font-semibold text-white ${className}`}
        >
          <button
            type="button"
            onClick={() => setShowDropdown((v) => !v)}
            className="flex items-center gap-2 hover:opacity-80"
          >
            <div className="h-2 w-2 rounded-full bg-green-500" />
            {addressShort}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(base58);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            aria-label="Copy address"
            className="rounded-md p-1 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>

        {showDropdown && (
          <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
            <button
              onClick={signOut}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Sign out
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

function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
