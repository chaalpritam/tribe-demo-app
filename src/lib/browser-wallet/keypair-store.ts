import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { keypairFromMnemonic } from "./mnemonic";

export const WALLET_STORAGE_KEY = "tribe_browser_wallet_v1";

interface StoredWallet {
  /** BIP39 mnemonic — kept so the user can re-display it from settings. */
  mnemonic: string;
  /**
   * 64-byte Solana secret key, base58. Cached so we don't have to do
   * BIP39 → seed → ed25519 derivation on every page load (it's slow,
   * tens of milliseconds).
   */
  secretKeyB58: string;
  /**
   * BIP44 account index this keypair was derived at (the third segment
   * of `m/44'/501'/<i>'/0'`). Optional so wallets stored before
   * multi-account support read back as account 0.
   */
  accountIndex?: number;
}

/**
 * localStorage isn't a secure store. Anything running in this origin
 * (or any DevTools tab) can read this. The setup UI shows a banner
 * making this clear; we still store the mnemonic so users can recover
 * across browsers / re-display it later.
 */
export function loadStoredKeypair(): Keypair | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredWallet;
    const secret = bs58.decode(parsed.secretKeyB58);
    return Keypair.fromSecretKey(secret);
  } catch {
    return null;
  }
}

export function loadStoredMnemonic(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as StoredWallet).mnemonic;
  } catch {
    return null;
  }
}

export async function saveMnemonic(
  mnemonic: string,
  accountIndex: number = 0,
): Promise<Keypair> {
  if (typeof window === "undefined") {
    throw new Error("Cannot save wallet outside browser");
  }
  const keypair = await keypairFromMnemonic(mnemonic, accountIndex);
  const secretKeyB58 = bs58.encode(keypair.secretKey);
  const payload: StoredWallet = { mnemonic, secretKeyB58, accountIndex };
  window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(payload));
  return keypair;
}

/**
 * Persist an already-derived keypair without recomputing the BIP39 →
 * ed25519 derivation. Used by the import flow: it derives several
 * candidate accounts, the user picks one, and we store the chosen
 * keypair directly.
 */
export function saveKeypair(
  mnemonic: string,
  keypair: Keypair,
  accountIndex: number,
): void {
  if (typeof window === "undefined") {
    throw new Error("Cannot save wallet outside browser");
  }
  const secretKeyB58 = bs58.encode(keypair.secretKey);
  const payload: StoredWallet = { mnemonic, secretKeyB58, accountIndex };
  window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(payload));
}

export function clearStoredKeypair(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(WALLET_STORAGE_KEY);
}

export function hasStoredKeypair(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WALLET_STORAGE_KEY) !== null;
}
