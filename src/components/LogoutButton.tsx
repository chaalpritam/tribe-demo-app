"use client";

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { STORAGE_KEYS } from "@/lib/constants";
import { WALLET_STORAGE_KEY } from "@/lib/browser-wallet/keypair-store";
import { DM_KEY_STORAGE } from "@/lib/crypto";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const { disconnect } = useWallet();

  const handleLogout = useCallback(async () => {
    try {
      await disconnect();
      // Clear all Tribe-related storage
      localStorage.removeItem(STORAGE_KEYS.tid);
      localStorage.removeItem(STORAGE_KEYS.tidWallet);
      localStorage.removeItem(STORAGE_KEYS.appKeySecret);
      localStorage.removeItem(WALLET_STORAGE_KEY);
      localStorage.removeItem("walletName"); // Clear wallet adapter preference
      sessionStorage.removeItem(DM_KEY_STORAGE);
      
      window.location.href = "/"; // Force redirect to home/landing
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }, [disconnect]);

  return (
    <button
      onClick={handleLogout}
      className={className || "w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors"}
    >
      Logout
    </button>
  );
}
