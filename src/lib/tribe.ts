import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import type { AnchorProvider } from "@coral-xyz/anchor";
import type { Connection } from "@solana/web3.js";
import { PROGRAM_IDS } from "./constants";

// Raw transaction building — avoids Anchor IDL version issues in the browser.

function tidToBuffer(tid: number): Buffer {
  const buf = Buffer.alloc(8);
  let val = tid;
  for (let i = 0; i < 8; i++) {
    buf[i] = val & 0xff;
    val = Math.floor(val / 256);
  }
  return buf;
}

function bnToLeBuffer(val: number, size: number = 8): Buffer {
  const bn = new BN(val);
  return bn.toArrayLike(Buffer, "le", size);
}

// Anchor instruction discriminators: SHA256("global:<name>")[0..8]
// Computed from the deployed Anchor 0.31.1 IDLs.
const DISC = {
  initialize:   Buffer.from([175, 175, 109,  31,  13, 152, 155, 237]),
  register:     Buffer.from([211, 124,  67,  15, 211, 194, 178, 240]),
  addAppKey:    Buffer.from([201, 126, 254, 221, 111, 252, 221, 120]),
  revokeAppKey: Buffer.from([ 46,   9, 208,   7,  74,  75, 169, 169]),
  initProfile:  Buffer.from([210, 162, 212,  95,  95, 186,  89, 119]),
  follow:       Buffer.from([161,  61, 150, 122, 164, 153,   0,  18]),
  unfollow:     Buffer.from([122,  47,  24, 161,  12,  85, 224,  68]),
};

// ── PDA Helpers ──────────────────────────────────────────────────────

function getGlobalStatePda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global_state")],
    PROGRAM_IDS.tidRegistry
  )[0];
}

function getTidRecordPda(tid: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tid"), tidToBuffer(tid)],
    PROGRAM_IDS.tidRegistry
  )[0];
}

function getCustodyLookupPda(custody: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("custody"), custody.toBuffer()],
    PROGRAM_IDS.tidRegistry
  )[0];
}

function getAppKeyPda(tid: number, appPubkey: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("app_key"), tidToBuffer(tid), appPubkey.toBuffer()],
    PROGRAM_IDS.appKeyRegistry
  )[0];
}

function getSocialProfilePda(tid: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("social_profile"), tidToBuffer(tid)],
    PROGRAM_IDS.socialGraph
  )[0];
}

function getLinkPda(followerTid: number, followingTid: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("link"), tidToBuffer(followerTid), tidToBuffer(followingTid)],
    PROGRAM_IDS.socialGraph
  )[0];
}

// ── Read Functions ───────────────────────────────────────────────────

/**
 * Look up a TID by custody wallet address.
 * Returns null if the wallet has no TID.
 */
export async function getTidByCustody(
  connection: Connection,
  walletPubkey: PublicKey
): Promise<number | null> {
  const pda = getCustodyLookupPda(walletPubkey);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;

  // CustodyLookup: 8 discriminator + 8 tid + 1 bump
  if (info.data.length < 16) return null;
  let tid = 0;
  for (let i = 0; i < 8; i++) {
    tid += info.data[8 + i] * 2 ** (i * 8);
  }
  return tid;
}

// ── Write Functions ──────────────────────────────────────────────────

/**
 * Register a new TID for the connected wallet.
 */
export async function registerTid(
  provider: AnchorProvider,
  recoveryAddress: PublicKey
): Promise<{ tx: string; tid: number }> {
  const globalState = getGlobalStatePda();

  // Read current tid_counter from GlobalState
  const info = await provider.connection.getAccountInfo(globalState);
  if (!info) throw new Error("Global state not initialized");

  // GlobalState: 8 disc + 8 tid_counter + 32 authority + 1 bump
  let tidCounter = 0;
  for (let i = 0; i < 8; i++) {
    tidCounter += info.data[8 + i] * 2 ** (i * 8);
  }
  const nextTid = tidCounter + 1;

  const tidRecord = getTidRecordPda(nextTid);
  const custodyLookup = getCustodyLookupPda(provider.wallet.publicKey);

  // Instruction data: 8 discriminator + 32 recovery_address
  const data = Buffer.concat([
    DISC.register,
    recoveryAddress.toBuffer(),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.tidRegistry,
    keys: [
      { pubkey: globalState, isSigner: false, isWritable: true },
      { pubkey: tidRecord, isSigner: false, isWritable: true },
      { pubkey: custodyLookup, isSigner: false, isWritable: true },
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const txn = new Transaction().add(ix);
  const sig = await provider.sendAndConfirm(txn);
  return { tx: sig, tid: nextTid };
}

/**
 * Add an app key for tweet signing.
 */
export async function addAppKey(
  provider: AnchorProvider,
  tid: number,
  appPubkey: PublicKey,
  scope: number = 0,
  expiresAt: number = 0
): Promise<string> {
  const tidRecord = getTidRecordPda(tid);
  const appKeyRecord = getAppKeyPda(tid, appPubkey);

  // Instruction data: 8 disc + 32 app_pubkey + 1 scope + 8 expires_at (i64 LE)
  const data = Buffer.concat([
    DISC.addAppKey,
    appPubkey.toBuffer(),
    Buffer.from([scope]),
    bnToLeBuffer(expiresAt, 8),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.appKeyRegistry,
    keys: [
      { pubkey: tidRecord, isSigner: false, isWritable: false },
      { pubkey: appKeyRecord, isSigner: false, isWritable: true },
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const txn = new Transaction().add(ix);
  return provider.sendAndConfirm(txn);
}

/**
 * Initialize a social profile (required before follow).
 */
export async function initSocialProfile(
  provider: AnchorProvider,
  tid: number
): Promise<string> {
  const tidRecord = getTidRecordPda(tid);
  const profile = getSocialProfilePda(tid);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.socialGraph,
    keys: [
      { pubkey: tidRecord, isSigner: false, isWritable: false },
      { pubkey: profile, isSigner: false, isWritable: true },
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISC.initProfile,
  });

  const txn = new Transaction().add(ix);
  return provider.sendAndConfirm(txn);
}

/**
 * Follow a user.
 */
export async function follow(
  provider: AnchorProvider,
  followerTid: number,
  followingTid: number
): Promise<string> {
  const followerTidRecord = getTidRecordPda(followerTid);
  const followerProfile = getSocialProfilePda(followerTid);
  const followingProfile = getSocialProfilePda(followingTid);
  const link = getLinkPda(followerTid, followingTid);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.socialGraph,
    keys: [
      { pubkey: followerTidRecord, isSigner: false, isWritable: false },
      { pubkey: followerProfile, isSigner: false, isWritable: true },
      { pubkey: followingProfile, isSigner: false, isWritable: true },
      { pubkey: link, isSigner: false, isWritable: true },
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISC.follow,
  });

  const txn = new Transaction().add(ix);
  return provider.sendAndConfirm(txn);
}

/**
 * Unfollow a user.
 */
export async function unfollow(
  provider: AnchorProvider,
  followerTid: number,
  followingTid: number
): Promise<string> {
  const followerTidRecord = getTidRecordPda(followerTid);
  const followerProfile = getSocialProfilePda(followerTid);
  const followingProfile = getSocialProfilePda(followingTid);
  const link = getLinkPda(followerTid, followingTid);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.socialGraph,
    keys: [
      { pubkey: followerTidRecord, isSigner: false, isWritable: false },
      { pubkey: followerProfile, isSigner: false, isWritable: true },
      { pubkey: followingProfile, isSigner: false, isWritable: true },
      { pubkey: link, isSigner: false, isWritable: true },
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
    ],
    data: DISC.unfollow,
  });

  const txn = new Transaction().add(ix);
  return provider.sendAndConfirm(txn);
}
