import nacl from "tweetnacl";
import { hubFetch } from "./failover";

/**
 * Hash data with blake3. Uses the browser WASM build.
 */
async function blake3Hash(data: Uint8Array): Promise<Uint8Array> {
  try {
    const blake3 = await import("blake3/browser");
    const result = blake3.hash(data);
    // blake3.hash() may return a Hash object with .toString('hex') or a Uint8Array
    if (result instanceof Uint8Array) return result;
    // If it's a Hash object, convert to Uint8Array
    return new Uint8Array(result);
  } catch {
    // Fallback: use SHA-256 if blake3 WASM fails to load
    const hashBuf = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(data) as unknown as BufferSource
    );
    return new Uint8Array(hashBuf);
  }
}

/**
 * Convert Uint8Array to base64 string (browser-safe).
 */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Sign a tweet message and publish it to the tweet server.
 */
export async function signAndPublishTweet(
  tid: number,
  text: string,
  signingKeySecret: Uint8Array,
  parentHash?: string,
  channelId?: string,
  embeds?: string[]
): Promise<{ hash: string }> {
  const timestamp = Math.floor(Date.now() / 1000);

  // Every tweet must belong to a channel. Fall back to the reserved
  // "general" channel so the protocol's "post to everyone" default
  // works even when the caller didn't pick one.
  const resolvedChannelId = (channelId || "").trim() || "general";

  const body: Record<string, unknown> = {
    text,
    mentions: [] as number[],
    embeds: embeds ?? ([] as string[]),
    channel_id: resolvedChannelId,
  };
  if (parentHash) body.parent_hash = parentHash;

  const data = {
    type: 1, // TWEET_ADD
    tid,
    timestamp,
    network: 2, // DEVNET
    body,
  };

  // Deterministic JSON → UTF-8 bytes → blake3 hash. dataBytes are
  // shipped on the wire (base64) so the hub can recompute blake3 and
  // reject any relay that tampered with hash/signature.
  const dataBytes = new TextEncoder().encode(JSON.stringify(data));
  const hashBytes = await blake3Hash(dataBytes);

  // Sign the hash with ed25519
  const keyPair = nacl.sign.keyPair.fromSecretKey(signingKeySecret);
  const signature = nacl.sign.detached(hashBytes, signingKeySecret);

  const message = {
    protocolVersion: 1,
    data,
    dataB64: toBase64(dataBytes),
    hash: toBase64(hashBytes),
    signature: toBase64(signature),
    signer: toBase64(keyPair.publicKey),
  };

  const res = await hubFetch("/v1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Tweet failed: ${res.status} ${errBody}`);
  }

  return res.json();
}

/**
 * Publish a signed TIP_ADD envelope to the hub. The on-chain settlement
 * (lamport transfer + TipRecord) happens via tribe.ts:sendTipOnchain;
 * this is the social-feed mirror that lets clients render the tip
 * alongside its on-chain receipt anchor.
 */
export async function signAndPublishTip(args: {
  senderTid: number;
  recipientTid: number;
  amount: number;
  currency?: string;
  /** Base64 hash of the tweet being tipped (optional). */
  targetHash?: string;
  /** Solana tx signature for the on-chain TipRecord (optional). */
  txSignature?: string;
}): Promise<{ hash: string }> {
  const secretKeyB64 = localStorage.getItem("tribe_app_key_secret");
  if (!secretKeyB64) throw new Error("No app key in localStorage");
  const secretKey = Uint8Array.from(atob(secretKeyB64), (c) => c.charCodeAt(0));
  const keyPair = nacl.sign.keyPair.fromSecretKey(secretKey);

  const body: Record<string, unknown> = {
    recipient_tid: args.recipientTid,
    amount: args.amount,
  };
  if (args.currency) body.currency = args.currency;
  if (args.targetHash) body.target_hash = args.targetHash;
  if (args.txSignature) body.tx_signature = args.txSignature;

  const data = {
    type: 25, // TIP_ADD
    tid: args.senderTid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2, // DEVNET
    body,
  };

  const dataBytes = new TextEncoder().encode(JSON.stringify(data));
  const hashBytes = await blake3Hash(dataBytes);
  const signature = nacl.sign.detached(hashBytes, secretKey);

  const message = {
    protocolVersion: 1,
    data,
    dataB64: toBase64(dataBytes),
    hash: toBase64(hashBytes),
    signature: toBase64(signature),
    signer: toBase64(keyPair.publicKey),
  };

  const res = await hubFetch("/v1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Tip envelope failed: ${res.status} ${errBody}`);
  }

  return res.json();
}

/**
 * Sign and submit a DM_KEY_REGISTER envelope so the hub can advertise
 * the caller's x25519 pubkey to other clients (used as the "send to me"
 * key for nacl.box DMs). Idempotent — overwrites any prior key for
 * this TID.
 */
export async function signAndRegisterDmKey(
  tid: number,
  x25519Pubkey: string,
  signingKeySecret: Uint8Array,
): Promise<{ tid: number; x25519_pubkey: string }> {
  const data = {
    type: 12, // DM_KEY_REGISTER
    tid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2, // DEVNET
    body: { x25519_pubkey: x25519Pubkey },
  };

  const dataBytes = new TextEncoder().encode(JSON.stringify(data));
  const hashBytes = await blake3Hash(dataBytes);
  const keyPair = nacl.sign.keyPair.fromSecretKey(signingKeySecret);
  const signature = nacl.sign.detached(hashBytes, signingKeySecret);

  const message = {
    protocolVersion: 1,
    data,
    dataB64: toBase64(dataBytes),
    hash: toBase64(hashBytes),
    signature: toBase64(signature),
    signer: toBase64(keyPair.publicKey),
  };

  const res = await hubFetch("/v1/dm/register-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`DM key register failed: ${res.status} ${errBody}`);
  }

  return res.json();
}

/**
 * Sign and submit a DM_SEND envelope. The hub stores ciphertext as-is
 * (never sees plaintext), gossips it to peer hubs, and surfaces it
 * via /v1/dm/messages/:conversationId. Recipient decrypts client-side
 * with the sender's x25519 key.
 */
export async function signAndSendDm(args: {
  senderTid: number;
  recipientTid: number;
  ciphertext: string;
  nonce: string;
  senderX25519: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string; conversation_id: string }> {
  const data = {
    type: 13, // DM_SEND
    tid: args.senderTid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2, // DEVNET
    body: {
      recipient_tid: args.recipientTid,
      ciphertext: args.ciphertext,
      nonce: args.nonce,
      sender_x25519: args.senderX25519,
    },
  };

  const dataBytes = new TextEncoder().encode(JSON.stringify(data));
  const hashBytes = await blake3Hash(dataBytes);
  const keyPair = nacl.sign.keyPair.fromSecretKey(args.signingKeySecret);
  const signature = nacl.sign.detached(hashBytes, args.signingKeySecret);

  const message = {
    protocolVersion: 1,
    data,
    dataB64: toBase64(dataBytes),
    hash: toBase64(hashBytes),
    signature: toBase64(signature),
    signer: toBase64(keyPair.publicKey),
  };

  const res = await hubFetch("/v1/dm/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`DM send failed: ${res.status} ${errBody}`);
  }

  return res.json();
}

/**
 * Toggle a bookmark on a target hash (tweet, reply, anything content-
 * addressable). Hub stores per-(tid, target_hash) in the `bookmarks`
 * table; subsequent ADDs are no-ops, REMOVEs delete the row.
 *
 * `add=true` → BOOKMARK_ADD (type 14)
 * `add=false` → BOOKMARK_REMOVE (type 15)
 */
export async function signAndBookmark(args: {
  tid: number;
  targetHash: string;
  add: boolean;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  const data = {
    type: args.add ? 14 : 15,
    tid: args.tid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2, // DEVNET
    body: { target_hash: args.targetHash },
  };

  const dataBytes = new TextEncoder().encode(JSON.stringify(data));
  const hashBytes = await blake3Hash(dataBytes);
  const keyPair = nacl.sign.keyPair.fromSecretKey(args.signingKeySecret);
  const signature = nacl.sign.detached(hashBytes, args.signingKeySecret);

  const message = {
    protocolVersion: 1,
    data,
    dataB64: toBase64(dataBytes),
    hash: toBase64(hashBytes),
    signature: toBase64(signature),
    signer: toBase64(keyPair.publicKey),
  };

  const res = await hubFetch("/v1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Bookmark ${args.add ? "add" : "remove"} failed: ${res.status} ${errBody}`);
  }

  return res.json();
}

/**
 * Tombstone a tweet via TWEET_REMOVE (type 2). The hub keeps the
 * original row but feed reads skip any tweet with a corresponding
 * REMOVE by the same author, so the tweet disappears across the UI
 * after the next refresh.
 */
export async function signAndRemoveTweet(args: {
  tid: number;
  targetHash: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  const data = {
    type: 2, // TWEET_REMOVE
    tid: args.tid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2, // DEVNET
    body: { target_hash: args.targetHash },
  };

  const dataBytes = new TextEncoder().encode(JSON.stringify(data));
  const hashBytes = await blake3Hash(dataBytes);
  const keyPair = nacl.sign.keyPair.fromSecretKey(args.signingKeySecret);
  const signature = nacl.sign.detached(hashBytes, args.signingKeySecret);

  const message = {
    protocolVersion: 1,
    data,
    dataB64: toBase64(dataBytes),
    hash: toBase64(hashBytes),
    signature: toBase64(signature),
    signer: toBase64(keyPair.publicKey),
  };

  const res = await hubFetch("/v1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Tweet remove failed: ${res.status} ${errBody}`);
  }

  return res.json();
}
