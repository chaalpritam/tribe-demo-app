import nacl from "tweetnacl";

/** Prefix for per-TID DM keypair slots: `tribe_dm_keypair_<tid>`. */
export const DM_KEY_STORAGE_PREFIX = "tribe_dm_keypair_";

/**
 * Pre-multi-account global slot. Held a single keypair shared across
 * every account that touched this browser. Kept around only for
 * one-shot migration in `getDmKeypair` — the first TID to ask for a
 * keypair claims it; subsequent TIDs get fresh keys. Other modules
 * (auth, backup) still need the name to know what to wipe / surface.
 */
export const LEGACY_DM_KEY_STORAGE = "tribe_dm_keypair";

function dmKeyStorageFor(tid: number): string {
  return `${DM_KEY_STORAGE_PREFIX}${tid}`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function parseStored(json: string): nacl.BoxKeyPair {
  const parsed = JSON.parse(json);
  return {
    publicKey: fromBase64(parsed.publicKey),
    secretKey: fromBase64(parsed.secretKey),
  };
}

function serialize(keypair: nacl.BoxKeyPair): string {
  return JSON.stringify({
    publicKey: toBase64(keypair.publicKey),
    secretKey: toBase64(keypair.secretKey),
  });
}

/**
 * Get or create the user's x25519 keypair for DMs, scoped per TID.
 *
 * Each account in this browser gets its own keypair under
 * `tribe_dm_keypair_<tid>`, so logging in as a different TID no
 * longer makes the previous account's hub-registered DM pubkey
 * collide with this one.
 *
 * Migration: pre-multi-account installs only had a single global
 * keypair at `tribe_dm_keypair`. The first TID to ask for a keypair
 * inherits it (preserving decryption of in-flight messages for that
 * one account); the legacy slot is then deleted so subsequent TIDs
 * generate fresh keys instead of all sharing the same secret.
 */
export function getDmKeypair(tid: number): nacl.BoxKeyPair {
  const slot = dmKeyStorageFor(tid);

  const existing = localStorage.getItem(slot);
  if (existing) return parseStored(existing);

  const legacy = localStorage.getItem(LEGACY_DM_KEY_STORAGE);
  if (legacy) {
    localStorage.setItem(slot, legacy);
    localStorage.removeItem(LEGACY_DM_KEY_STORAGE);
    return parseStored(legacy);
  }

  const keypair = nacl.box.keyPair();
  localStorage.setItem(slot, serialize(keypair));
  return keypair;
}

/** Base64 x25519 public key for the given TID's DM keypair. */
export function getDmPublicKey(tid: number): string {
  return toBase64(getDmKeypair(tid).publicKey);
}

/**
 * Encrypt a message for a recipient using x25519 + xsalsa20-poly1305,
 * sealed with the given sender TID's DM keypair.
 */
export function encryptMessage(
  plaintext: string,
  recipientPubkey: string,
  senderTid: number,
): { encrypted: string; nonce: string } {
  const keypair = getDmKeypair(senderTid);
  const nonce = nacl.randomBytes(24);
  const messageBytes = new TextEncoder().encode(plaintext);
  const recipientKey = fromBase64(recipientPubkey);

  const encrypted = nacl.box(messageBytes, nonce, recipientKey, keypair.secretKey);
  if (!encrypted) throw new Error("Encryption failed");

  return {
    encrypted: toBase64(encrypted),
    nonce: toBase64(nonce),
  };
}

/**
 * Decrypt a message addressed to the given TID, using the peer's
 * x25519 public key as the other side of the ECDH.
 */
export function decryptMessage(
  encryptedB64: string,
  nonceB64: string,
  peerPubkey: string,
  myTid: number,
): string | null {
  const keypair = getDmKeypair(myTid);
  const encrypted = fromBase64(encryptedB64);
  const nonce = fromBase64(nonceB64);
  const peerKey = fromBase64(peerPubkey);

  const decrypted = nacl.box.open(encrypted, nonce, peerKey, keypair.secretKey);
  if (!decrypted) return null;

  return new TextDecoder().decode(decrypted);
}
