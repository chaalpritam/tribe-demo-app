"use client";

import { useState, useCallback, useEffect } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import nacl from "tweetnacl";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  registerTid,
  addAppKey,
  registerUsername,
  initSocialProfile,
} from "@/lib/tribe";
import { SOLANA_RPC_URL, STORAGE_KEYS } from "@/lib/constants";
import ImportBackup from "./ImportBackup";

// Below this we assume the wallet can't afford a TID register tx
// (rent + fees ≈ 0.005 SOL). Threshold is generous so we surface
// the airdrop UI before the user actually hits a "simulation failed"
// — clearer for first-time browser-wallet users.
const MIN_BALANCE_LAMPORTS = 0.01 * LAMPORTS_PER_SOL;

function detectCluster(rpcUrl: string): "devnet" | "testnet" | "mainnet" | "localnet" {
  if (rpcUrl.includes("devnet")) return "devnet";
  if (rpcUrl.includes("testnet")) return "testnet";
  if (rpcUrl.includes("localhost") || rpcUrl.includes("127.0.0.1")) return "localnet";
  return "mainnet";
}

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

  // Auto-skip steps if already registered on-chain
  useEffect(() => {
    if (!wallet || initialStep !== "register") return;

    async function checkStatus() {
      setLoading(true);
      try {
        const provider = getProvider();
        const onChainTid = await registerTid(provider, wallet!.publicKey);
        // registerTid returns existing if it exists without sending tx
        if (onChainTid.tid) {
          setTid(onChainTid.tid);
          localStorage.setItem(STORAGE_KEYS.tid, onChainTid.tid.toString());
          localStorage.setItem(STORAGE_KEYS.tidWallet, wallet!.publicKey.toBase58());
          
          // Check for username
          const { hasUsername } = await import("@/lib/tribe");
          const exists = await hasUsername(connection, onChainTid.tid);
          if (exists) {
            setStep("appkey");
          } else {
            setStep("username");
          }
        }
      } catch (e) {
        console.error("Auto-check failed:", e);
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, [wallet, initialStep]);

  const handleRegisterTid = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const provider = getProvider();
      const result = await registerTid(provider, wallet.publicKey);
      setTid(result.tid);
      localStorage.setItem(STORAGE_KEYS.tid, result.tid.toString());
      // If tx is null, the wallet already had a TID — skip straight ahead
      setStep("username");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Failed to register TID";
      // Common Solana error shapes that mean "not enough SOL". Surface
      // the airdrop hint so the user doesn't have to read a stack trace.
      const insufficientFunds =
        /insufficient|InsufficientFundsForRent|0x1$|debit an account/i.test(raw);
      setError(
        insufficientFunds
          ? "This wallet doesn't have enough SOL to pay for registration. See the yellow banner above to airdrop."
          : raw,
      );
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
    <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900">
        {step === "appkey" ? "Complete Your Setup" : "Set Up Your Identity"}
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        {step === "appkey" 
          ? "You're registered! Now generate a signing key to start posting." 
          : "Register your Tribe ID to start posting and connecting with others."}
      </p>

      {/* Progress indicator */}
      <div className="mt-4 flex gap-1">
        {["register", "username", "appkey"].map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              i <=
              ["register", "username", "appkey"].indexOf(step)
                ? "bg-gray-900"
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {loading && step === "register" && (
        <div className="mt-10 flex flex-col items-center justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500 font-medium">Checking your account status...</p>
        </div>
      )}

      {!loading && step === "register" && (
        <div className="mt-6">
          <p className="text-sm text-gray-700">
            Step 1 of 3: Register your Tribe ID (TID) on Solana.
          </p>
          {wallet && <LowBalanceBanner publicKey={wallet.publicKey} />}
          <button
            onClick={handleRegisterTid}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 shadow-sm"
          >
            {loading ? "Registering..." : "Register TID"}
          </button>
        </div>
      )}

      {step === "username" && (
        <div className="mt-6">
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
            <p className="text-sm text-green-700">
              TID #{tid} registered!
            </p>
          </div>
          <p className="mt-4 text-sm text-gray-700">
            Step 2 of 3: Choose a username (your .tribe handle).
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value.toLowerCase())}
              placeholder="username"
              maxLength={20}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 outline-none focus:border-gray-900 focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-gray-500">.tribe</span>
          </div>
          {usernameInput && !isValidUsername && (
            <p className="mt-1 text-xs text-amber-700">
              3-20 chars, lowercase letters, numbers, underscores only
            </p>
          )}
          <button
            onClick={handleRegisterUsername}
            disabled={loading || !isValidUsername}
            className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 shadow-sm"
          >
            {loading ? "Registering..." : "Register Username"}
          </button>
          <button
            onClick={handleSkipUsername}
            className="mt-2 w-full text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            Skip for now
          </button>
        </div>
      )}

      {step === "appkey" && (
        <div className="mt-6">
          <p className="text-sm text-gray-700">
            Step 3 of 3: Generate a signing key for posting tweets.
          </p>
          <button
            onClick={handleAddAppKey}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50 shadow-sm"
          >
            {loading ? "Setting up..." : "Generate Signing Key"}
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <p className="text-sm text-green-700">
            All set! You can now post tweets and follow others.
          </p>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8 border-t border-gray-100 pt-6 text-center">
        <ImportBackup />
      </div>
    </div>
  );
}

/**
 * Inline banner shown on the Register TID screen when the connected
 * wallet doesn't have enough SOL to pay for the registration tx (rent
 * + fees). Polls balance every 5s so external funding (web faucet, CLI
 * airdrop, transfer from another wallet) is reflected automatically.
 *
 * On devnet/testnet/localnet, exposes a one-click airdrop button.
 * On mainnet, falls back to instructions ("send SOL to this address").
 */
function LowBalanceBanner({ publicKey }: { publicKey: PublicKey }) {
  const { connection } = useConnection();
  const [lamports, setLamports] = useState<number | null>(null);
  const [airdropping, setAirdropping] = useState(false);
  const [airdropError, setAirdropError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cluster = detectCluster(SOLANA_RPC_URL);

  const refreshBalance = useCallback(async () => {
    try {
      const bal = await connection.getBalance(publicKey, "confirmed");
      setLamports(bal);
    } catch {
      setLamports(null);
    }
  }, [connection, publicKey]);

  // Poll balance: catches both manual airdrops (user used CLI / faucet
  // in another tab) and the just-after-airdrop state where finality
  // can lag the requestAirdrop response.
  useEffect(() => {
    refreshBalance();
    const id = setInterval(refreshBalance, 5000);
    return () => clearInterval(id);
  }, [refreshBalance]);

  const handleAirdrop = useCallback(async () => {
    setAirdropping(true);
    setAirdropError(null);
    try {
      const sig = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
      const blockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature: sig, ...blockhash },
        "confirmed",
      );
      await refreshBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Airdrop failed";
      // Devnet airdrops are aggressively rate-limited per IP. Surface
      // that distinctly so the user goes to the web faucet instead of
      // hammering retry.
      if (/429|rate|limit/i.test(msg)) {
        setAirdropError(
          "Airdrop rate-limited. Try the web faucet (link below) or wait a few minutes.",
        );
      } else {
        setAirdropError(msg);
      }
    } finally {
      setAirdropping(false);
    }
  }, [connection, publicKey, refreshBalance]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [publicKey]);

  // Don't render anything until we have a balance read; once we do,
  // hide if the wallet is funded.
  if (lamports === null || lamports >= MIN_BALANCE_LAMPORTS) return null;

  const sol = (lamports / LAMPORTS_PER_SOL).toFixed(4);
  const addressShort = `${publicKey.toBase58().slice(0, 8)}…${publicKey
    .toBase58()
    .slice(-4)}`;
  const canAirdrop = cluster !== "mainnet";

  return (
    <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3">
      <p className="text-sm font-semibold text-yellow-900">
        Low SOL balance — registration will fail.
      </p>
      <p className="mt-1 text-xs text-yellow-900">
        This wallet has <span className="font-mono">{sol} SOL</span> on{" "}
        <span className="font-semibold">{cluster}</span>. Registering a TID
        needs ~0.005 SOL for rent + fees.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-yellow-100 px-2 py-1 font-mono text-xs text-yellow-900">
          {addressShort}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-yellow-400 bg-white px-2 py-1 text-xs text-yellow-900 hover:bg-yellow-100"
        >
          {copied ? "Copied" : "Copy address"}
        </button>
      </div>

      {canAirdrop ? (
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAirdrop}
            disabled={airdropping}
            className="rounded-lg bg-yellow-600 px-3 py-2 text-sm font-semibold text-white hover:bg-yellow-700 disabled:opacity-50"
          >
            {airdropping ? "Airdropping…" : "Airdrop 1 SOL"}
          </button>
          {cluster === "devnet" && (
            <p className="text-xs text-yellow-900">
              Or use the web faucet:{" "}
              <a
                href={`https://faucet.solana.com/?address=${publicKey.toBase58()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                faucet.solana.com
              </a>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-yellow-900">
          On <span className="font-semibold">mainnet</span>, send SOL to the
          address above from any wallet, then refresh.
        </p>
      )}

      {airdropError && (
        <p className="mt-2 text-xs text-red-700">{airdropError}</p>
      )}

      <button
        type="button"
        onClick={refreshBalance}
        className="mt-2 text-xs text-yellow-800 underline hover:text-yellow-900"
      >
        Refresh balance
      </button>
    </div>
  );
}
