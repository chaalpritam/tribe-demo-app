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

function readU64LE(data: Uint8Array, offset: number): number {
  let val = 0;
  for (let i = 0; i < 8; i++) {
    val += data[offset + i] * 2 ** (i * 8);
  }
  return val;
}

function bnToLeBuffer(val: number, size: number = 8): Buffer {
  const bn = new BN(val);
  return bn.toArrayLike(Buffer, "le", size);
}

// Anchor instruction discriminators: SHA256("global:<name>")[0..8]
const DISC = {
  initialize:       Buffer.from([175, 175, 109,  31,  13, 152, 155, 237]),
  register:         Buffer.from([211, 124,  67,  15, 211, 194, 178, 240]),
  addAppKey:        Buffer.from([201, 126, 254, 221, 111, 252, 221, 120]),
  initProfile:      Buffer.from([210, 162, 212,  95,  95, 186,  89, 119]),
  follow:           Buffer.from([161,  61, 150, 122, 164, 153,   0,  18]),
  unfollow:         Buffer.from([122,  47,  24, 161,  12,  85, 224,  68]),
  registerUsername: Buffer.from([134,  54, 123, 181,  28, 151,  36,   0]),
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

function getUsernameRecordPda(username: string): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("username"), Buffer.from(username)],
    PROGRAM_IDS.usernameRegistry
  )[0];
}

function getTidUsernamePda(tid: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("tid_username"), tidToBuffer(tid)],
    PROGRAM_IDS.usernameRegistry
  )[0];
}

// ── Read Functions ───────────────────────────────────────────────────

export async function getTidByCustody(
  connection: Connection,
  walletPubkey: PublicKey
): Promise<number | null> {
  const pda = getCustodyLookupPda(walletPubkey);
  const info = await connection.getAccountInfo(pda);
  if (!info || info.data.length < 16) return null;
  return readU64LE(info.data, 8);
}

export async function hasUsername(
  connection: Connection,
  tid: number
): Promise<boolean> {
  const pda = getTidUsernamePda(tid);
  const info = await connection.getAccountInfo(pda);
  return info !== null;
}

export async function hasSocialProfile(
  connection: Connection,
  tid: number
): Promise<boolean> {
  const pda = getSocialProfilePda(tid);
  const info = await connection.getAccountInfo(pda);
  return info !== null;
}

// ── Write Functions ──────────────────────────────────────────────────

export async function registerTid(
  provider: AnchorProvider,
  recoveryAddress: PublicKey
): Promise<{ tx: string; tid: number }> {
  const globalState = getGlobalStatePda();
  const info = await provider.connection.getAccountInfo(globalState);
  if (!info) throw new Error("Global state not initialized");

  const tidCounter = readU64LE(info.data, 8);
  const nextTid = tidCounter + 1;

  const tidRecord = getTidRecordPda(nextTid);
  const custodyLookup = getCustodyLookupPda(provider.wallet.publicKey);

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

export async function addAppKey(
  provider: AnchorProvider,
  tid: number,
  appPubkey: PublicKey,
  scope: number = 0,
  expiresAt: number = 0
): Promise<string> {
  const tidRecord = getTidRecordPda(tid);
  const appKeyRecord = getAppKeyPda(tid, appPubkey);

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

export async function registerUsername(
  provider: AnchorProvider,
  tid: number,
  username: string
): Promise<string> {
  const tidRecord = getTidRecordPda(tid);
  const usernameRecord = getUsernameRecordPda(username);
  const tidUsername = getTidUsernamePda(tid);

  // Anchor string serialization: 4-byte LE length prefix + UTF-8 bytes
  const usernameBytes = Buffer.from(username, "utf-8");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(usernameBytes.length);

  const data = Buffer.concat([
    DISC.registerUsername,
    lenBuf,
    usernameBytes,
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_IDS.usernameRegistry,
    keys: [
      { pubkey: tidRecord, isSigner: false, isWritable: false },
      { pubkey: usernameRecord, isSigner: false, isWritable: true },
      { pubkey: tidUsername, isSigner: false, isWritable: true },
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const txn = new Transaction().add(ix);
  return provider.sendAndConfirm(txn);
}

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
