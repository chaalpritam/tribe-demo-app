"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchUserActivity,
  type ActivityRow,
  type ActivityType,
} from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import ConnectionRequired from "@/components/ConnectionRequired";

const VERB: Record<ActivityType, string> = {
  tid_registered: "Registered TID on Solana",
  tweet: "Posted a tweet",
  tweet_reply: "Replied to a tweet",
  reaction_like: "Liked a tweet",
  reaction_recast: "Retweeted",
  bookmark: "Bookmarked a tweet",
  dm_sent: "Sent a DM",
  tip_sent: "Sent a tip",
  tip_received: "Received a tip",
  follow_pending: "Follow (settling on-chain)",
  follow_settled: "Followed (on-chain)",
  follow_failed: "Follow failed",
  unfollow_pending: "Unfollow (settling on-chain)",
  unfollow_settled: "Unfollowed (on-chain)",
  unfollow_failed: "Unfollow failed",
};

const ON_CHAIN_TYPES = new Set<ActivityType>([
  "tid_registered",
  "follow_pending",
  "follow_settled",
  "follow_failed",
  "unfollow_pending",
  "unfollow_settled",
  "unfollow_failed",
  "tip_sent",
  "tip_received",
]);

type FilterId = "all" | "onchain" | "offchain";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "onchain", label: "On-chain" },
  { id: "offchain", label: "Signed off-chain" },
];

function relativeTime(iso: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function tweetLinkFor(row: ActivityRow): string | null {
  if (!row.target_hash) return null;
  switch (row.type) {
    case "tweet":
    case "tweet_reply":
    case "reaction_like":
    case "reaction_recast":
    case "bookmark":
      return `/tweet?hash=${encodeURIComponent(row.target_hash)}`;
    default:
      return null;
  }
}

export default function ActivityPage() {
  return (
    <ConnectionRequired
      title="Activity"
      description="Connect your wallet to see your full on-chain and signed activity log."
    >
      <ActivityView />
    </ConnectionRequired>
  );
}

function ActivityView() {
  const [tid, setTid] = useState<string | null>(null);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (!stored) {
      setLoaded(true);
      return;
    }
    setTid(stored);
    let cancelled = false;
    // Pull a generous limit so the dedicated page actually shows
    // history (the sidebar card preview only fetches 50 by default).
    fetchUserActivity(stored, 200)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    const onChain = ON_CHAIN_TYPES.has(r.type);
    return filter === "onchain" ? onChain : !onChain;
  });

  const onChainCount = rows.filter((r) => ON_CHAIN_TYPES.has(r.type)).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Activity</h1>
        <p className="text-xs uppercase tracking-wider text-gray-400">
          {onChainCount} on-chain · {rows.length} total
        </p>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Every signed envelope your account produced and every on-chain op the
        Ephemeral Rollup has settled for you. Solana tx links open in a block
        explorer for independent verification.
      </p>

      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filter === f.id
                ? "bg-gray-900 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
        </div>
      ) : !tid ? (
        <p className="mt-8 text-center text-gray-500">
          No TID found in this browser. Sign in to see your activity.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">
          {filter === "onchain"
            ? "No on-chain activity yet — follow someone or send a tip to start your on-chain history."
            : filter === "offchain"
              ? "No signed envelopes yet — post a tweet, like something, or send a DM."
              : "No activity yet."}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map((row, i) => {
            const detailLink = tweetLinkFor(row);
            const explorerLink = row.tx_signature
              ? `https://explorer.solana.com/tx/${encodeURIComponent(row.tx_signature)}?cluster=devnet`
              : null;
            const onChain = ON_CHAIN_TYPES.has(row.type);
            return (
              <li
                key={`${row.type}:${row.target_hash ?? row.peer_tid ?? i}:${row.timestamp}`}
                className={`rounded-xl border px-4 py-3 ${
                  onChain
                    ? "border-emerald-100 bg-emerald-50/50"
                    : "border-gray-100 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          onChain
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-700 text-white"
                        }`}
                      >
                        {onChain ? "On-chain" : "Signed"}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {VERB[row.type]}
                      </span>
                    </div>
                    {(row.preview || row.peer_tid) && (
                      <p className="mt-1 text-sm text-gray-700">
                        {row.peer_tid ? (
                          <Link
                            href={`/profile?tid=${row.peer_tid}`}
                            className="font-medium text-gray-900 hover:underline"
                          >
                            TID #{row.peer_tid}
                          </Link>
                        ) : null}
                        {row.peer_tid && row.preview ? " · " : null}
                        {row.preview ? <span>{row.preview}</span> : null}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">
                    {relativeTime(row.timestamp)}
                  </span>
                </div>
                {(detailLink || explorerLink) && (
                  <div className="mt-2 flex gap-4 text-xs">
                    {detailLink && (
                      <Link
                        href={detailLink}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        View →
                      </Link>
                    )}
                    {explorerLink && (
                      <a
                        href={explorerLink}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-semibold text-emerald-700 hover:underline"
                      >
                        Solana tx ↗
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
