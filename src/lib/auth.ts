"use client";

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { STORAGE_KEYS } from "./constants";
import { WALLET_STORAGE_KEY } from "./browser-wallet/keypair-store";
import { DM_KEY_STORAGE } from "./crypto";

/**
 * Full sign-out: disconnects the wallet adapter and wipes every piece
 * of local state that ties this browser to a Tribe account, then
 * redirects to the welcome page. Used by both the wallet pill dropdown
 * and the Settings logout row so the destructive path is identical.
 */
export function useSignOut(): () => Promise<void> {
  const { disconnect } = useWallet();

  return useCallback(async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error("Sign-out disconnect failed:", err);
    }
    localStorage.removeItem(STORAGE_KEYS.tid);
    localStorage.removeItem(STORAGE_KEYS.tidWallet);
    localStorage.removeItem(STORAGE_KEYS.appKeySecret);
    localStorage.removeItem(WALLET_STORAGE_KEY);
    localStorage.removeItem("walletName");
    sessionStorage.removeItem(DM_KEY_STORAGE);
    window.location.href = "/";
  }, [disconnect]);
}
