import { STORAGE_KEYS } from "./constants";
import { WALLET_STORAGE_KEY } from "./browser-wallet/keypair-store";
import { DM_KEY_STORAGE } from "./crypto";

const SUPPORTED_BACKUP_VERSION = 1;
export const BACKUP_TIMESTAMP_KEY = "tribe_last_backup_at";

export interface BackupData {
  version: 1;
  timestamp: number;
  data: {
    tid: string | null;
    tidWallet: string | null;
    appKeySecret: string | null;
    browserWallet: string | null;
    dmKeypair: string | null;
  };
}

/**
 * Best-effort detection of an encrypted backup payload. Encrypted files
 * are pure base64; plain backups are JSON starting with `{`. Trying to
 * JSON.parse first is more reliable than relying on the `.enc` suffix,
 * which a user can rename.
 */
export function isEncryptedBackup(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return false;
  return /^[A-Za-z0-9+/=\s]+$/.test(trimmed);
}

export function markBackupComplete(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BACKUP_TIMESTAMP_KEY, String(Date.now()));
}

export function getLastBackupAt(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(BACKUP_TIMESTAMP_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function createBackupPayload(): BackupData {
  return {
    version: 1,
    timestamp: Date.now(),
    data: {
      tid: localStorage.getItem(STORAGE_KEYS.tid),
      tidWallet: localStorage.getItem(STORAGE_KEYS.tidWallet),
      appKeySecret: localStorage.getItem(STORAGE_KEYS.appKeySecret),
      browserWallet: localStorage.getItem(WALLET_STORAGE_KEY),
      dmKeypair: sessionStorage.getItem(DM_KEY_STORAGE),
    },
  };
}

export function downloadBackupFile(payload: BackupData, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.tribe`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function encryptBackup(payload: BackupData, password: string): Promise<string> {
  const payloadStr = JSON.stringify(payload);
  const pwData = new TextEncoder().encode(password) as BufferSource;

  // Use Web Crypto API for better performance and security (PBKDF2 + AES-GCM)
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    pwData,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(payloadStr) as BufferSource
  );
  
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function decryptBackup(encryptedB64: string, password: string): Promise<BackupData> {
  const combined = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const data = combined.slice(28);
  
  const pwData = new TextEncoder().encode(password) as BufferSource;
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    pwData,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  
  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (e) {
    throw new Error("Invalid password or corrupted backup file");
  }
}

export function applyBackup(backup: BackupData) {
  if (backup?.version !== SUPPORTED_BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version ${backup?.version}. This app supports v${SUPPORTED_BACKUP_VERSION}.`,
    );
  }
  if (!backup.data || typeof backup.data !== "object") {
    throw new Error("Backup is missing the data section.");
  }
  const { data } = backup;
  if (!data.browserWallet) {
    throw new Error(
      "Backup is missing the wallet keypair — restoring it would leave the account unrecoverable.",
    );
  }
  if (data.tid) localStorage.setItem(STORAGE_KEYS.tid, data.tid);
  if (data.tidWallet) localStorage.setItem(STORAGE_KEYS.tidWallet, data.tidWallet);
  if (data.appKeySecret) localStorage.setItem(STORAGE_KEYS.appKeySecret, data.appKeySecret);
  localStorage.setItem(WALLET_STORAGE_KEY, data.browserWallet);
  // Auto-select Browser Wallet so the app connects immediately on reload
  localStorage.setItem("walletName", '"Browser Wallet"');
  if (data.dmKeypair) sessionStorage.setItem(DM_KEY_STORAGE, data.dmKeypair);
  markBackupComplete();
}
