"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import QRCode from "qrcode";
import {
  fetchTipsReceived,
  fetchTipsSent,
  fetchUser,
  type TipRow,
} from "@/lib/api";
import { signAndPublishTip } from "@/lib/messages";
import {
  getCustodyByTid,
  getTidByCustody,
  sendTipOnchain,
} from "@/lib/tribe";
import { STORAGE_KEYS } from "@/lib/constants";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import ConnectionRequired from "@/components/ConnectionRequired";

type ActivityRow = TipRow & { direction: "sent" | "received" };

export default function WalletPage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [myTid, setMyTid] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(stored);
  }, []);

  useEffect(() => {
    if (!myTid) return;
    fetchUser(myTid)
      .then((u) => setMyUsername(u?.username ?? null))
      .catch(() => {});
  }, [myTid]);

  const refreshBalance = useCallback(async () => {
    if (!publicKey) return;
    setLoadingBalance(true);
    try {
      const lamports = await connection.getBalance(publicKey);
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch {
      setBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  }, [publicKey, connection]);

  const refreshActivity = useCallback(async () => {
    if (!myTid) return;
    setActivityLoading(true);
    try {
      const [sent, received] = await Promise.all([
        fetchTipsSent(myTid),
        fetchTipsReceived(myTid),
      ]);
      const merged: ActivityRow[] = [
        ...sent.tips.map((t) => ({ ...t, direction: "sent" as const })),
        ...received.tips.map((t) => ({ ...t, direction: "received" as const })),
      ];
      merged.sort(
        (a, b) =>
          new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
      );
      setActivity(merged);
    } finally {
      setActivityLoading(false);
    }
  }, [myTid]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    refreshActivity();
  }, [refreshActivity]);

  return (
    <ConnectionRequired 
      title="Wallet" 
      description="Connect your wallet to manage your SOL, send tips, and view your transaction history."
    >
      <div className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title="Wallet"
        subtitle="Send, receive, and view tip activity"
      />

      {/* Balance card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Balance
        </p>
        <p className="mt-1 font-mono text-3xl text-gray-900">
          {balance === null ? (
            <span className="text-gray-400">—</span>
          ) : (
            <>
              {balance.toLocaleString(undefined, {
                maximumFractionDigits: 6,
              })}{" "}
              <span className="text-base text-gray-500">SOL</span>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {publicKey?.toBase58().slice(0, 6)}…
          {publicKey?.toBase58().slice(-6)}
          {myUsername ? ` · ${myUsername}.tribe` : ""}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setShowSend(true)}
            disabled={!wallet}
            className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Send
          </button>
          <button
            onClick={() => setShowReceive(true)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Receive
          </button>
          <button
            onClick={refreshBalance}
            disabled={loadingBalance}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
            aria-label="Refresh balance"
          >
            {loadingBalance ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Activity */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Recent activity</h2>
          {activityLoading && <span className="text-xs text-gray-500">Loading…</span>}
        </div>

        {activity.length === 0 && !activityLoading ? (
          <div className="mt-2">
            <EmptyState
              title="No activity yet"
              body="Tips you send or receive — including those attached to tweets — will show up here."
            />
          </div>
        ) : (
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {activity.map((row) => (
              <ActivityItem key={row.hash} row={row} myTid={myTid} />
            ))}
          </div>
        )}
      </div>

      {showSend && myTid && wallet && (
        <SendModal
          onClose={() => setShowSend(false)}
          onSent={() => {
            setShowSend(false);
            refreshBalance();
            refreshActivity();
          }}
          myTid={parseInt(myTid, 10)}
        />
      )}

      {showReceive && publicKey && (
        <ReceiveModal
          onClose={() => setShowReceive(false)}
          address={publicKey.toBase58()}
          tid={myTid}
          username={myUsername}
        />
      )}
    </div>
    </ConnectionRequired>
  );
}

function ActivityItem({
  row,
  myTid,
}: {
  row: ActivityRow;
  myTid: string | null;
}) {
  const counterpartyTid =
    row.direction === "sent" ? row.recipient_tid : row.sender_tid;
  const sign = row.direction === "sent" ? "−" : "+";
  const explorerUrl = row.tx_signature
    ? `https://explorer.solana.com/tx/${row.tx_signature}?cluster=devnet`
    : null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-gray-800">
          <span className="font-semibold capitalize">{row.direction}</span>{" "}
          <span className="text-gray-500">
            {row.direction === "sent" ? "to" : "from"}
          </span>{" "}
          <span className="font-semibold text-gray-900">
            {(row as any).counterparty_username ? `${(row as any).counterparty_username}.tribe` : `TID #${counterpartyTid}`}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {new Date(row.sent_at).toLocaleString()}
          {row.target_hash ? " · attached to a tweet" : ""}
        </p>
      </div>
      <div className="text-right">
        <p
          className={`font-mono text-sm font-semibold ${
            row.direction === "sent" ? "text-gray-900" : "text-emerald-700"
          }`}
        >
          {sign}
          {Number(row.amount).toLocaleString(undefined, {
            maximumFractionDigits: 6,
          })}{" "}
          {row.currency}
        </p>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[11px] text-blue-600 hover:underline"
          >
            View tx
          </a>
        )}
      </div>
    </div>
  );
}

function SendModal({
  onClose,
  onSent,
  myTid,
}: {
  onClose: () => void;
  onSent: () => void;
  myTid: number;
}) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet()!;
  const [recipientInput, setRecipientInput] = useState("");
  const [resolved, setResolved] = useState<{
    tid: number;
    address: PublicKey;
    username: string | null;
  } | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [amount, setAmount] = useState("0.01");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-resolve recipient: TID number, or wallet address.
  useEffect(() => {
    const trimmed = recipientInput.trim();
    if (!trimmed) {
      setResolved(null);
      setResolveError(null);
      return;
    }
    let cancelled = false;
    setResolving(true);
    setResolveError(null);
    (async () => {
      try {
        let tid: number | null = null;
        let address: PublicKey | null = null;
        if (/^\d+$/.test(trimmed)) {
          tid = parseInt(trimmed, 10);
          address = await getCustodyByTid(connection, tid);
          if (!address) throw new Error("TID has no registered wallet");
        } else {
          try {
            address = new PublicKey(trimmed);
          } catch {
            throw new Error("Not a valid TID or wallet address");
          }
          tid = await getTidByCustody(connection, address);
          if (tid === null) {
            throw new Error("Wallet not registered with Tribe");
          }
        }
        const userRes = await fetchUser(String(tid));
        if (cancelled) return;
        setResolved({ tid, address, username: userRes?.username ?? null });
      } catch (err) {
        if (cancelled) return;
        setResolved(null);
        setResolveError(
          err instanceof Error ? err.message : "Could not resolve recipient",
        );
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipientInput, connection]);

  const amountNum = Number(amount);
  const canSend =
    !!resolved &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    resolved.tid !== myTid &&
    !busy;

  const handleSend = useCallback(async () => {
    if (!resolved || !canSend) return;
    setBusy(true);
    setError(null);
    try {
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });
      const lamports = BigInt(Math.floor(amountNum * LAMPORTS_PER_SOL));
      const { txSig } = await sendTipOnchain(provider, {
        senderTid: myTid,
        recipient: resolved.address,
        recipientTid: resolved.tid,
        amountLamports: lamports,
      });
      try {
        await signAndPublishTip({
          senderTid: myTid,
          recipientTid: resolved.tid,
          amount: amountNum,
          currency: "SOL",
          txSignature: txSig,
        });
      } catch (envErr) {
        console.warn("Send succeeded on-chain but envelope publish failed", envErr);
      }
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }, [resolved, canSend, connection, wallet, myTid, amountNum, onSent]);

  return (
    <Modal title="Send" onClose={onClose}>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          To
        </label>
        <input
          value={recipientInput}
          onChange={(e) => setRecipientInput(e.target.value)}
          placeholder="TID or wallet address"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-gray-900"
        />
        <div className="mt-1 min-h-5 text-xs">
          {resolving && <span className="text-gray-500">Resolving…</span>}
          {resolved && (
            <span className="text-gray-700">
              <span className="font-semibold">TID #{resolved.tid}</span>
              {resolved.username ? ` · ${resolved.username}.tribe` : ""} · {" "}
              <span className="font-mono text-gray-500">
                {resolved.address.toBase58().slice(0, 6)}…
                {resolved.address.toBase58().slice(-6)}
              </span>
            </span>
          )}
          {resolved && resolved.tid === myTid && (
            <span className="ml-2 text-red-600">Can&apos;t send to yourself</span>
          )}
          {resolveError && <span className="text-red-600">{resolveError}</span>}
        </div>
      </div>

      <div className="mt-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Amount (SOL)
        </label>
        <input
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-gray-900"
        />
        <div className="mt-2 flex gap-2">
          {[0.001, 0.01, 0.05, 0.1].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        Sends settle on Solana via the tip-registry program and publish a
        signed TIP_ADD envelope to the hub, so the transfer shows up in the
        recipient&apos;s notifications and karma.
      </p>
    </Modal>
  );
}

function ReceiveModal({
  onClose,
  address,
  tid,
  username,
}: {
  onClose: () => void;
  address: string;
  tid: string | null;
  username: string | null;
}) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(address, { width: 240, margin: 1 })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [address]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <Modal title="Receive" onClose={onClose}>
      <div className="flex flex-col items-center">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt="Wallet address QR"
            className="rounded-lg border border-gray-200"
            width={240}
            height={240}
          />
        ) : (
          <div className="flex h-60 w-60 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-500">
            Generating QR…
          </div>
        )}

        <div className="mt-4 w-full">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Wallet address
          </p>
          <p className="mt-1 break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-800">
            {address}
          </p>
        </div>

        {(tid || username) && (
          <div className="mt-3 w-full">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Tribe identity
            </p>
            <p className="mt-1 text-sm text-gray-800">
              {username ? `${username}.tribe` : `TID #${tid}`}
              {username && tid ? ` · TID #${tid}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Senders inside Tribe can use your TID instead of pasting the
              full address.
            </p>
          </div>
        )}

        <div className="mt-5 flex w-full gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            {copied ? "Copied!" : "Copy address"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

