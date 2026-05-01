"use client";

import { useState, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { decryptBackup, applyBackup, type BackupData } from "@/lib/backup";

export default function ImportBackup() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { disconnect } = useWallet();
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError(null);
      setSuccess(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      let backup: BackupData;

      if (file.name.endsWith(".enc")) {
        if (!password) {
          setError("Password is required for encrypted backups");
          setLoading(false);
          return;
        }
        backup = await decryptBackup(text, password);
      } else {
        backup = JSON.parse(text);
      }

      // Important: Disconnect current wallet to prevent the app from 
      // immediately clearing the restored cache due to a mismatch.
      try {
        await disconnect();
      } catch (e) {
        console.warn("Failed to disconnect during import:", e);
      }
      
      applyBackup(backup);
      setSuccess(true);
      
      // Short delay so the user can see the success message
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import backup");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-4"
      >
        Import account from backup
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-gray-900">Import Account</h2>
        <p className="mt-2 text-sm text-gray-500">
          Select your .tribe backup file to restore your account.
        </p>

        <div className="mt-6 space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-10 hover:border-gray-900 hover:bg-gray-50"
          >
            {file ? (
              <p className="font-medium text-gray-900">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-gray-500">Click to select file</p>
                <p className="mt-1 text-xs text-gray-400">.tribe or .tribe.enc</p>
              </>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".tribe,.enc"
              className="hidden"
            />
          </div>

          {file?.name.endsWith(".enc") && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Backup Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{error}</p>
          )}

          {success && (
            <p className="text-sm text-emerald-600 bg-emerald-50 p-2 rounded-lg">
              Account restored successfully! Reloading...
            </p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setIsOpen(false)}
              disabled={loading || success}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!file || loading || success}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Importing..." : success ? "Restored" : "Restore Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
