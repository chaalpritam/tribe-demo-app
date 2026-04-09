"use client";

import { useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import {
  registerTid,
  addAppKey,
  registerUsername,
  initSocialProfile,
} from "@/lib/tribe";
import { STORAGE_KEYS } from "@/lib/constants";

export type Step = "register" | "username" | "appkey" | "done";

interface RegisterIdentityProps {
  onRegistered: (tid: number) => void;
  initialStep?: Step;
  existingTid?: number | null;
}

export default function RegisterIdentity({
  onRegistered,
  initialStep = "register",
  existingTid = null,
}: RegisterIdentityProps) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [step, setStep] = useState<Step>(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tid, setTid] = useState<number | null>(existingTid);
  const [usernameInput, setUsernameInput] = useState("");

  function getProvider() {
    if (!wallet) throw new Error("Wallet not connected");
    return new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
  }

  const handleRegisterTid = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const provider = getProvider();
      const result = await registerTid(provider, wallet.publicKey);
      setTid(result.tid);
      localStorage.setItem(STORAGE_KEYS.tid, result.tid.toString());
      setStep("username");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register TID");
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  const handleRegisterUsername = useCallback(async () => {
    if (!wallet || tid === null || !usernameInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const provider = getProvider();
      await registerUsername(provider, tid, usernameInput.trim().toLowerCase());
      setStep("appkey");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register username"
      );
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, tid, usernameInput]);

  const handleSkipUsername = useCallback(() => {
    setStep("appkey");
  }, []);

  const handleAddAppKey = useCallback(async () => {
    if (!wallet || tid === null) return;
    setLoading(true);
    setError(null);
    try {
      const provider = getProvider();

      // Generate nacl keypair for tweet signing
      const keyPair = nacl.sign.keyPair();
      const appPubkey = new PublicKey(keyPair.publicKey);
      await addAppKey(provider, tid, appPubkey);

      // Store secret key
      const b64 = btoa(
        String.fromCharCode(...keyPair.secretKey)
      );
      localStorage.setItem(STORAGE_KEYS.appKeySecret, b64);

      // Also init social profile so user can follow others
      try {
        await initSocialProfile(provider, tid);
      } catch {
        // May already exist — that's fine
      }

      setStep("done");
      onRegistered(tid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add app key");
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, tid, onRegistered]);

  const isValidUsername =
    usernameInput.length >= 3 &&
    usernameInput.length <= 20 &&
    /^[a-z0-9_]+$/.test(usernameInput.toLowerCase());

  return (
    <div className="mx-auto max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6">
      <h2 className="text-xl font-bold text-white">Set Up Your Identity</h2>
      <p className="mt-2 text-sm text-gray-400">
        Register your Tribe ID to start posting and connecting with others.
      </p>

      {/* Progress indicator */}
      <div className="mt-4 flex gap-1">
        {["register", "username", "appkey"].map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              i <=
              ["register", "username", "appkey"].indexOf(step)
                ? "bg-purple-600"
                : "bg-gray-700"
            }`}
          />
        ))}
      </div>

      {step === "register" && (
        <div className="mt-6">
          <p className="text-sm text-gray-300">
            Step 1 of 3: Register your Tribe ID (TID) on Solana.
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

      {step === "username" && (
        <div className="mt-6">
          <div className="rounded-lg bg-green-900/30 px-3 py-2">
            <p className="text-sm text-green-400">
              TID #{tid} registered!
            </p>
          </div>
          <p className="mt-4 text-sm text-gray-300">
            Step 2 of 3: Choose a username (your .tribe handle).
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value.toLowerCase())}
              placeholder="username"
              maxLength={20}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-purple-600"
            />
            <span className="text-gray-400">.tribe</span>
          </div>
          {usernameInput && !isValidUsername && (
            <p className="mt-1 text-xs text-yellow-500">
              3-20 chars, lowercase letters, numbers, underscores only
            </p>
          )}
          <button
            onClick={handleRegisterUsername}
            disabled={loading || !isValidUsername}
            className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Registering..." : "Register Username"}
          </button>
          <button
            onClick={handleSkipUsername}
            className="mt-2 w-full text-sm text-gray-500 hover:text-gray-300"
          >
            Skip for now
          </button>
        </div>
      )}

      {step === "appkey" && (
        <div className="mt-6">
          <p className="text-sm text-gray-300">
            Step 3 of 3: Generate a signing key for posting tweets.
          </p>
          <button
            onClick={handleAddAppKey}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Generate Signing Key"}
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="mt-6 rounded-lg bg-green-900/30 px-3 py-2">
          <p className="text-sm text-green-400">
            All set! You can now post tweets and follow others.
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
