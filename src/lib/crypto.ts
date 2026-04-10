import nacl from "tweetnacl";

const DM_KEY_STORAGE = "tribe_dm_keypair";

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

/**
 * Get or create the user's x25519 keypair for DMs.
 * Stored in sessionStorage.
 */
export function getDmKeypair(): nacl.BoxKeyPair {
  const stored = sessionStorage.getItem(DM_KEY_STORAGE);
  if (stored) {
    const parsed = JSON.parse(stored);
    return {
      publicKey: fromBase64(parsed.publicKey),
      secretKey: fromBase64(parsed.secretKey),
    };
  }

  const keypair = nacl.box.keyPair();
  sessionStorage.setItem(
    DM_KEY_STORAGE,
    JSON.stringify({
      publicKey: toBase64(keypair.publicKey),
      secretKey: toBase64(keypair.secretKey),
    })
  );
  return keypair;
}

/**
 * Get the x25519 public key as base64.
 */
export function getDmPublicKey(): string {
  return toBase64(getDmKeypair().publicKey);
}

/**
 * Encrypt a message for a recipient using x25519 + xsalsa20-poly1305.
 */
export function encryptMessage(
  plaintext: string,
  recipientPubkey: string
): { encrypted: string; nonce: string } {
  const keypair = getDmKeypair();
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
 * Decrypt a message from a sender.
 */
export function decryptMessage(
  encryptedB64: string,
  nonceB64: string,
  senderPubkey: string
): string | null {
  const keypair = getDmKeypair();
  const encrypted = fromBase64(encryptedB64);
  const nonce = fromBase64(nonceB64);
  const senderKey = fromBase64(senderPubkey);

  const decrypted = nacl.box.open(encrypted, nonce, senderKey, keypair.secretKey);
  if (!decrypted) return null;

  return new TextDecoder().decode(decrypted);
}
