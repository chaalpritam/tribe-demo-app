import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";

/**
 * BIP44 base path Solana wallets converged on. Phantom, Solflare, and
 * solana-keygen all vary the third segment per account (account #0 is
 * `m/44'/501'/0'/0'`, account #1 is `m/44'/501'/1'/0'`, etc.) — matching
 * that here means a phrase from any of those tools resolves the same
 * accounts in the same order.
 */
function solanaDerivationPath(accountIndex: number): string {
  return `m/44'/501'/${accountIndex}'/0'`;
}

export type MnemonicStrength = 12 | 24;

export interface DerivedAccount {
  index: number;
  keypair: Keypair;
}

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
 * Solana path for the given account index. Throws if the mnemonic is
 * invalid. `accountIndex` defaults to 0, which is the first account
 * Phantom / Solflare / solana-keygen create from a phrase.
 */
export async function keypairFromMnemonic(
  phrase: string,
  accountIndex: number = 0,
): Promise<Keypair> {
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
  const { key } = derivePath(solanaDerivationPath(accountIndex), seedHex);
  return Keypair.fromSeed(new Uint8Array(key));
}

/**
 * Derive `count` consecutive Solana accounts (indices 0..count-1) from a
 * mnemonic. Used to let users pick which account to import when their
 * phrase has more than one — the same way Phantom / Solflare let you
 * "Add account" off the same seed. The expensive PBKDF2 step inside
 * `mnemonicToSeed` runs once and is reused across all derivations.
 */
export async function deriveAccountsFromMnemonic(
  phrase: string,
  count: number,
): Promise<DerivedAccount[]> {
  const normalized = normalizeMnemonic(phrase);
  if (!bip39.validateMnemonic(normalized)) {
    throw new Error("Invalid BIP39 mnemonic");
  }
  const seedBytes = await bip39.mnemonicToSeed(normalized);
  const seedHex = Buffer.from(seedBytes).toString("hex");
  const accounts: DerivedAccount[] = [];
  for (let i = 0; i < count; i++) {
    const { key } = derivePath(solanaDerivationPath(i), seedHex);
    accounts.push({
      index: i,
      keypair: Keypair.fromSeed(new Uint8Array(key)),
    });
  }
  return accounts;
}
