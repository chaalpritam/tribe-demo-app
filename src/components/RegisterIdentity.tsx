"use client";

import { useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { registerTid, addAppKey } from "@/lib/tribe";
import { STORAGE_KEYS } from "@/lib/constants";

interface RegisterIdentityProps {
  onRegistered: (tid: number) => void;
}

export default function RegisterIdentity({ onRegistered }: RegisterIdentityProps) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [step, setStep] = useState<"register" | "appkey" | "done">("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tid, setTid] = useState<number | null>(null);

  const handleRegisterTid = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);

    try {
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });

      // Use wallet pubkey as recovery address for simplicity
      const result = await registerTid(provider, wallet.publicKey);
      setTid(result.tid);
      localStorage.setItem(STORAGE_KEYS.tid, result.tid.toString());
      setStep("appkey");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register TID");
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const handleAddAppKey = useCallback(async () => {
    if (!wallet || tid === null) return;
    setLoading(true);
    setError(null);

    try {
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });

      // Generate a new nacl keypair for tweet signing
      const keyPair = nacl.sign.keyPair();

      // Register the public key on-chain
      const appPubkey = new PublicKey(keyPair.publicKey);
      await addAppKey(provider, tid, appPubkey);

      // Store the secret key in localStorage
      localStorage.setItem(
        STORAGE_KEYS.appKeySecret,
        Buffer.from(keyPair.secretKey).toString("base64")
      );

      setStep("done");
      onRegistered(tid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add app key");
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, tid, onRegistered]);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="text-xl font-bold text-white">Set Up Your Identity</h2>
      <p className="mt-2 text-sm text-gray-400">
        Register a Tribe ID to start posting and following others on the
        decentralized social network.
      </p>

      {step === "register" && (
        <div className="mt-6">
          <p className="text-sm text-gray-300">
            Step 1: Register your Tribe ID (TID) on Solana devnet.
          </p>
          <button
            onClick={handleRegisterTid}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Registering..." : "Register TID"}
          </button>
        </div>
      )}

      {step === "appkey" && (
        <div className="mt-6">
          <div className="rounded-lg bg-green-900/30 px-3 py-2">
            <p className="text-sm text-green-400">
              TID #{tid} registered successfully!
            </p>
          </div>
          <p className="mt-4 text-sm text-gray-300">
            Step 2: Generate and register an app key for signing tweets.
          </p>
          <button
            onClick={handleAddAppKey}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Adding Key..." : "Add App Key"}
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="mt-6 rounded-lg bg-green-900/30 px-3 py-2">
          <p className="text-sm text-green-400">
            All set! You can now post tweets.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
