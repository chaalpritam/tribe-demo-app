import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";

/**
 * BIP44 derivation path Solana wallets converged on. Phantom, Solflare,
 * the official `solana-keygen` CLI all use this — so a mnemonic created
 * here works in any of those tools, and a phrase from any of them works
 * here.
 */
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export type MnemonicStrength = 12 | 24;

/**
 * Generate a fresh BIP39 mnemonic. 24 words = 256 bits of entropy and
 * is what Solana's keygen tools use by default. 12 is also valid.
 */
export function generateMnemonic(strength: MnemonicStrength = 24): string {
  // bip39.generateMnemonic takes entropy bits: 12 words = 128 bits,
  // 24 words = 256 bits.
  return bip39.generateMnemonic(strength === 24 ? 256 : 128);
}

export function isValidMnemonic(phrase: string): boolean {
  return bip39.validateMnemonic(normalizeMnemonic(phrase));
}

/**
 * Trim, lowercase, and collapse whitespace so a phrase pasted with
 * stray spaces / newlines / casing still validates.
 */
export function normalizeMnemonic(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(" ");
}

/**
 * Derive a Solana Keypair from a BIP39 mnemonic at the standard
 * Solana path. Throws if the mnemonic is invalid.
 */
export async function keypairFromMnemonic(phrase: string): Promise<Keypair> {
  const normalized = normalizeMnemonic(phrase);
  if (!bip39.validateMnemonic(normalized)) {
    throw new Error("Invalid BIP39 mnemonic");
  }
  // bip39.mnemonicToSeed expects an empty passphrase by default, which
  // matches Phantom / solana-keygen behaviour. Anyone who set a
  // BIP39 passphrase in another wallet would need to derive separately
  // — we don't support that here yet.
  const seedBytes = await bip39.mnemonicToSeed(normalized);
  // ed25519-hd-key takes a hex string of the seed.
  const seedHex = Buffer.from(seedBytes).toString("hex");
  const { key } = derivePath(SOLANA_DERIVATION_PATH, seedHex);
  return Keypair.fromSeed(new Uint8Array(key));
}
