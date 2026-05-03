"use client";

import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { STORAGE_KEYS } from "./constants";
import { WALLET_STORAGE_KEY } from "./browser-wallet/keypair-store";

/**
 * Full sign-out: disconnects the wallet adapter and wipes every piece
 * of local state that ties this browser to a Tribe account, then
 * redirects to the welcome page. Used by both the wallet pill dropdown
 * and the Settings logout row so the destructive path is identical.
 *
 * DM keypairs (`tribe_dm_keypair_<tid>`) are intentionally retained
 * so the user keeps the secrets needed to decrypt past messages if
 * they sign back in to the same account. To wipe everything, use
 * "Clear local data" in ConnectionRequired.
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
    window.location.href = "/";
  }, [disconnect]);
}
