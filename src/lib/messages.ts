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

/**
 * Subtype byte stored on REACTION_ADD envelopes, mirroring
 * tribe-protocol's ReactionType enum: 1 = LIKE, 2 = RECAST.
 *
 * Note: REACTION_REMOVE on the hub clears EVERY reaction the user
 * has on a target regardless of subtype (see
 * tribe-hub/src/api/routes/users.ts), so toggling off a retweet
 * also clears a like on the same tweet. Acceptable for v1.
 */
export type ReactionSubtype = 1 | 2;

/**
 * Internal: build + submit a signed REACTION envelope.
 *   add=true  → REACTION_ADD (type 3) with body.type=subtype
 *   add=false → REACTION_REMOVE (type 4); subtype is ignored by the
 *               hub but included so the wire shape stays consistent.
 */
async function signAndReact(args: {
  tid: number;
  targetHash: string;
  subtype: ReactionSubtype;
  add: boolean;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  const data = {
    type: args.add ? 3 : 4,
    tid: args.tid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2, // DEVNET
    body: {
      type: args.subtype,
      target_hash: args.targetHash,
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

  const res = await hubFetch("/v1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `Reaction ${args.add ? "add" : "remove"} (subtype ${args.subtype}) failed: ${res.status} ${errBody}`,
    );
  }

  return res.json();
}

/**
 * Toggle a like (REACTION subtype 1) on a target tweet.
 */
export async function signAndLikeTweet(args: {
  tid: number;
  targetHash: string;
  add: boolean;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  return signAndReact({ ...args, subtype: 1 });
}

/**
 * Toggle a retweet (REACTION subtype 2 / RECAST) on a target tweet.
 * Same envelope path as a like — the hub's submit route accepts both
 * subtypes via REACTION_ADD; only body.type differs.
 */
export async function signAndRetweet(args: {
  tid: number;
  targetHash: string;
  add: boolean;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  return signAndReact({ ...args, subtype: 2 });
}

/**
 * Set or update a single profile field via USER_DATA_ADD (type 7).
 * The hub keeps a per-tid history in user_data and exposes the
 * latest-per-field on /v1/user/:tid as `profile`.
 *
 * Allowed fields (enforced by hub): displayName, bio, pfpUrl, url,
 * location, city. Max value length: 500 chars.
 */
export type ProfileField =
  | "displayName"
  | "bio"
  | "pfpUrl"
  | "url"
  | "location"
  | "city";

export async function signAndPublishUserData(args: {
  tid: number;
  field: ProfileField;
  value: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  const data = {
    type: 7, // USER_DATA_ADD
    tid: args.tid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2, // DEVNET
    body: { field: args.field, value: args.value },
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
    throw new Error(`User data update failed: ${res.status} ${errBody}`);
  }

  return res.json();
}

/** ChannelKind values match the protobuf enum the hub validates against. */
export const ChannelKind = {
  CITY: 2,
  INTEREST: 3,
} as const;

export type ChannelKindValue = (typeof ChannelKind)[keyof typeof ChannelKind];

/**
 * Create a new channel via CHANNEL_ADD (type 9). The hub rejects:
 *   - empty channel_id or channel_id that doesn't match /^[a-z0-9-]{1,64}$/
 *   - the reserved id "general"
 *   - kind = GENERAL (1) — only CITY (2) and INTEREST (3) are user-creatable
 *
 * latitude/longitude are persisted only when kind is CITY.
 */
export async function signAndCreateChannel(args: {
  tid: number;
  channelId: string;
  name: string;
  description?: string;
  kind: ChannelKindValue;
  latitude?: number;
  longitude?: number;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  const body: Record<string, unknown> = {
    channel_id: args.channelId,
    name: args.name,
    kind: args.kind,
  };
  if (args.description) body.description = args.description;
  if (args.kind === ChannelKind.CITY) {
    if (typeof args.latitude === "number") body.latitude = args.latitude;
    if (typeof args.longitude === "number") body.longitude = args.longitude;
  }

  return submitChannelEnvelope({
    type: 9, // CHANNEL_ADD
    tid: args.tid,
    body,
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Channel create",
  });
}

/** Join a channel via CHANNEL_JOIN (type 10). */
export async function signAndJoinChannel(args: {
  tid: number;
  channelId: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  return submitChannelEnvelope({
    type: 10,
    tid: args.tid,
    body: { channel_id: args.channelId },
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Channel join",
  });
}

/** Leave a channel via CHANNEL_LEAVE (type 11). */
export async function signAndLeaveChannel(args: {
  tid: number;
  channelId: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  return submitChannelEnvelope({
    type: 11,
    tid: args.tid,
    body: { channel_id: args.channelId },
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Channel leave",
  });
}

async function submitChannelEnvelope(args: {
  type: number;
  tid: number;
  body: Record<string, unknown>;
  signingKeySecret: Uint8Array;
  errorLabel: string;
}): Promise<{ hash: string }> {
  return submitTypedEnvelope(args);
}

/**
 * Generic signed-envelope publisher. The various signAndX helpers all
 * share the same JSON+blake3+ed25519+dataB64 path; this is the one
 * place to maintain it. type is the MessageType integer.
 */
async function submitTypedEnvelope(args: {
  type: number;
  tid: number;
  body: Record<string, unknown>;
  signingKeySecret: Uint8Array;
  errorLabel: string;
}): Promise<{ hash: string }> {
  const data = {
    type: args.type,
    tid: args.tid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2, // DEVNET
    body: args.body,
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
    throw new Error(`${args.errorLabel} failed: ${res.status} ${errBody}`);
  }

  return res.json();
}

/**
 * Create a poll via POLL_ADD (type 16). Hub validates poll_id against
 * `^[a-z0-9-]{1,64}$`, requires 2–10 options, and rejects votes for an
 * out-of-range option_index. expires_at is unix seconds (optional).
 */
export async function signAndCreatePoll(args: {
  tid: number;
  pollId: string;
  question: string;
  options: string[];
  expiresAtUnix?: number;
  channelId?: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  const body: Record<string, unknown> = {
    poll_id: args.pollId,
    question: args.question,
    options: args.options,
  };
  if (args.expiresAtUnix) body.expires_at = args.expiresAtUnix;
  if (args.channelId) body.channel_id = args.channelId;
  return submitTypedEnvelope({
    type: 16,
    tid: args.tid,
    body,
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Poll create",
  });
}

/** Vote on a poll via POLL_VOTE (type 17). Re-voting overwrites the prior choice. */
export async function signAndVotePoll(args: {
  tid: number;
  pollId: string;
  optionIndex: number;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  return submitTypedEnvelope({
    type: 17,
    tid: args.tid,
    body: { poll_id: args.pollId, option_index: args.optionIndex },
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Poll vote",
  });
}

/**
 * Create an event via EVENT_ADD (type 18). starts_at / ends_at are
 * unix seconds. lat/lng + location_text are optional metadata.
 */
export async function signAndCreateEvent(args: {
  tid: number;
  eventId: string;
  title: string;
  description?: string;
  startsAtUnix: number;
  endsAtUnix?: number;
  locationText?: string;
  latitude?: number;
  longitude?: number;
  channelId?: string;
  imageUrl?: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  const body: Record<string, unknown> = {
    event_id: args.eventId,
    title: args.title,
    starts_at: args.startsAtUnix,
  };
  if (args.description) body.description = args.description;
  if (args.endsAtUnix) body.ends_at = args.endsAtUnix;
  if (args.locationText) body.location_text = args.locationText;
  if (typeof args.latitude === "number") body.latitude = args.latitude;
  if (typeof args.longitude === "number") body.longitude = args.longitude;
  if (args.channelId) body.channel_id = args.channelId;
  if (args.imageUrl) body.image_url = args.imageUrl;
  return submitTypedEnvelope({
    type: 18,
    tid: args.tid,
    body,
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Event create",
  });
}

/** RSVP to an event via EVENT_RSVP (type 19). status: yes / no / maybe. */
export type RsvpStatus = "yes" | "no" | "maybe";

export async function signAndRsvpEvent(args: {
  tid: number;
  eventId: string;
  status: RsvpStatus;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  return submitTypedEnvelope({
    type: 19,
    tid: args.tid,
    body: { event_id: args.eventId, status: args.status },
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Event RSVP",
  });
}

/**
 * Create a task via TASK_ADD (type 20). Hub validates task_id against
 * `^[a-z0-9-]{1,64}$`. Status starts at "open"; claim moves it to
 * "claimed", complete moves it to "completed".
 *
 * reward_text is a free-form description of the reward (the protocol
 * doesn't escrow funds — the off-chain envelope is just an
 * advertisement; on-chain task-registry exists for that flow).
 */
export async function signAndCreateTask(args: {
  tid: number;
  taskId: string;
  title: string;
  description?: string;
  rewardText?: string;
  channelId?: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  const body: Record<string, unknown> = {
    task_id: args.taskId,
    title: args.title,
  };
  if (args.description) body.description = args.description;
  if (args.rewardText) body.reward_text = args.rewardText;
  if (args.channelId) body.channel_id = args.channelId;
  return submitTypedEnvelope({
    type: 20,
    tid: args.tid,
    body,
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Task create",
  });
}

/** Claim an open task via TASK_CLAIM (type 21). Hub rejects if not "open". */
export async function signAndClaimTask(args: {
  tid: number;
  taskId: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  return submitTypedEnvelope({
    type: 21,
    tid: args.tid,
    body: { task_id: args.taskId },
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Task claim",
  });
}

/**
 * Mark a claimed task complete via TASK_COMPLETE (type 22). Hub rejects
 * if not in "claimed" state OR the caller is neither the claimer nor
 * the creator (the creator can mark complete on behalf of the claimer
 * — useful for "I see you finished the task, marking done").
 */
export async function signAndCompleteTask(args: {
  tid: number;
  taskId: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  return submitTypedEnvelope({
    type: 22,
    tid: args.tid,
    body: { task_id: args.taskId },
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Task complete",
  });
}

/**
 * Create a crowdfund via CROWDFUND_ADD (type 23). The hub stores a
 * positive `goal_amount` and an optional `deadline_at` (unix seconds).
 * Currency is free-form ("USD" by default at the hub side).
 */
export async function signAndCreateCrowdfund(args: {
  tid: number;
  crowdfundId: string;
  title: string;
  description?: string;
  goalAmount: number;
  currency?: string;
  deadlineAtUnix?: number;
  imageUrl?: string;
  channelId?: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  const body: Record<string, unknown> = {
    crowdfund_id: args.crowdfundId,
    title: args.title,
    goal_amount: args.goalAmount,
  };
  if (args.description) body.description = args.description;
  if (args.currency) body.currency = args.currency;
  if (args.deadlineAtUnix) body.deadline_at = args.deadlineAtUnix;
  if (args.imageUrl) body.image_url = args.imageUrl;
  if (args.channelId) body.channel_id = args.channelId;
  return submitTypedEnvelope({
    type: 23,
    tid: args.tid,
    body,
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Crowdfund create",
  });
}

/**
 * Pledge to a crowdfund via CROWDFUND_PLEDGE (type 24). Off-chain
 * envelope only — the actual fund movement happens via tip-registry
 * or directly on Solana with the crowdfund-registry's PDA.
 */
export async function signAndPledgeCrowdfund(args: {
  tid: number;
  crowdfundId: string;
  amount: number;
  currency?: string;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string }> {
  const body: Record<string, unknown> = {
    crowdfund_id: args.crowdfundId,
    amount: args.amount,
  };
  if (args.currency) body.currency = args.currency;
  return submitTypedEnvelope({
    type: 24,
    tid: args.tid,
    body,
    signingKeySecret: args.signingKeySecret,
    errorLabel: "Crowdfund pledge",
  });
}

/**
 * Group DMs use a fan-out encryption pattern: the sender encrypts
 * the same plaintext once per recipient with that recipient's
 * x25519 pubkey, packs the ciphertexts into the envelope, and
 * the hub stores one row per recipient. Each member can decrypt
 * only their own slot.
 *
 * Hub validates: caller must be a member to send; group_id must
 * match `^[a-z0-9-]{1,64}$`; member_tids must include >=2 members
 * (typically the creator + at least one other).
 */
export async function signAndCreateGroup(args: {
  tid: number;
  groupId: string;
  name: string;
  memberTids: number[];
  signingKeySecret: Uint8Array;
}): Promise<{ group_id: string }> {
  // Use the messages-side helper rather than POSTing direct to the
  // dm/groups/create route, since the hub validates the envelope
  // through verifyAndPersistEnvelope just like every other write.
  const data = {
    type: 26, // DM_GROUP_CREATE
    tid: args.tid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2,
    body: {
      group_id: args.groupId,
      name: args.name,
      // Hub stores tids as bigint; serialize numbers as numbers (the
      // submit route parses both string and number forms).
      member_tids: args.memberTids,
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
  const res = await hubFetch("/v1/dm/groups/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Group create failed: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Send a per-recipient-encrypted group message. Caller is responsible
 * for producing the ciphertexts array — encrypt the same plaintext
 * once per recipient with that recipient's x25519 pubkey using
 * tweetnacl's `box`, with a fresh nonce per recipient.
 */
export async function signAndSendGroupMessage(args: {
  tid: number;
  groupId: string;
  senderX25519: string;
  ciphertexts: Array<{ recipient_tid: number; ciphertext: string; nonce: string }>;
  signingKeySecret: Uint8Array;
}): Promise<{ hash: string; group_id: string }> {
  const data = {
    type: 27, // DM_GROUP_SEND
    tid: args.tid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2,
    body: {
      group_id: args.groupId,
      sender_x25519: args.senderX25519,
      ciphertexts: args.ciphertexts,
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
  const res = await hubFetch("/v1/dm/groups/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Group send failed: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Mark progress through a 1:1 conversation via DM_READ (type 28).
 * Hub keeps the latest read mark per (tid, conversation_id), so
 * later reads with an older timestamp are ignored. Both participants
 * can render each other's last-read marker via
 * GET /v1/dm/conversations/:id/reads.
 */
export async function signAndMarkRead(args: {
  tid: number;
  conversationId: string;
  lastReadHash: string;
  signingKeySecret: Uint8Array;
}): Promise<{ ok: boolean }> {
  const data = {
    type: 28, // DM_READ
    tid: args.tid,
    timestamp: Math.floor(Date.now() / 1000),
    network: 2,
    body: {
      conversation_id: args.conversationId,
      last_read_hash: args.lastReadHash,
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
  const res = await hubFetch("/v1/dm/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DM read mark failed: ${res.status} ${err}`);
  }
  return res.json();
}
