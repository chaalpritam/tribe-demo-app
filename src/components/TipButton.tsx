"use client";

import { useCallback, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getCustodyByTid, sendTipOnchain } from "@/lib/tribe";
import { signAndPublishTip } from "@/lib/messages";

interface TipButtonProps {
  /** TID of the tweet author — the recipient. */
  recipientTid: number;
  /** TID of the signed-in user — the sender. */
  senderTid: number;
  /** Hash of the tweet being tipped (base64 from the hub feed). */
  tweetHash: string;
  initialCount?: number;
}

const PRESETS_SOL = [0.001, 0.01, 0.05];

/**
 * Convert a base64-encoded blake3 hash from the hub feed back into
 * the 32-byte buffer the on-chain target_hash field expects.
 */
function decodeBase64Hash(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export default function TipButton({
  recipientTid,
  senderTid,
  tweetHash,
  initialCount = 0,
}: TipButtonProps) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [open, setOpen] = useState(false);
  const [tipped, setTipped] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(
    async (amountSol: number) => {
      if (!wallet || busy) return;
      setBusy(true);
      setError(null);
      try {
        const recipient = await getCustodyByTid(connection, recipientTid);
        if (!recipient) {
          throw new Error("Could not resolve recipient wallet");
        }

        const provider = new AnchorProvider(connection, wallet, {
          commitment: "confirmed",
        });

        const targetHash = decodeBase64Hash(tweetHash);
        const amountLamports = BigInt(Math.floor(amountSol * LAMPORTS_PER_SOL));

        const { txSig } = await sendTipOnchain(provider, {
          senderTid,
          recipient,
          recipientTid,
          amountLamports,
          targetHash,
        });

        // Publish the off-chain TIP_ADD envelope so the social feed
        // shows the tip alongside its on-chain receipt. Best effort —
        // a failure here doesn't undo the on-chain settlement.
        try {
          await signAndPublishTip({
            senderTid,
            recipientTid,
            amount: amountSol,
            currency: "SOL",
            targetHash: tweetHash,
            txSignature: txSig,
          });
        } catch (envErr) {
          console.warn("Tip succeeded on chain but envelope publish failed", envErr);
        }

        setTipped(true);
        setCount((c) => c + 1);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tip failed");
      } finally {
        setBusy(false);
      }
    },
    [wallet, busy, connection, recipientTid, senderTid, tweetHash]
  );

  // Self-tip: hide the button entirely on your own tweets.
  if (senderTid === recipientTid) return null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={!wallet}
        className={`flex items-center gap-1 text-sm transition-colors ${
          tipped ? "text-amber-500" : "text-gray-500 hover:text-amber-400"
        } disabled:opacity-50`}
        title={wallet ? "Tip this tweet" : "Connect wallet to tip"}
      >
        <svg
          className="h-4 w-4"
          fill={tipped ? "currentColor" : "none"}
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={tipped ? 0 : 1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
        {count > 0 && <span>{count}</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Tip in SOL
          </p>
          {PRESETS_SOL.map((sol) => (
            <button
              key={sol}
              onClick={() => handleSend(sol)}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-gray-800 hover:bg-amber-50 disabled:opacity-50"
            >
              <span>{sol} SOL</span>
              <span className="text-xs text-gray-400">
                ≈ {sol * LAMPORTS_PER_SOL} lamports
              </span>
            </button>
          ))}
          {busy && (
            <p className="px-2 py-1 text-xs text-gray-500">Confirming…</p>
          )}
          {error && (
            <p className="px-2 py-1 text-xs text-red-500">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
