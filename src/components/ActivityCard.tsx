"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchUserActivity,
  type ActivityRow,
  type ActivityType,
} from "@/lib/api";

interface ActivityCardProps {
  tid: string;
}

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

function relativeTime(iso: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

function ActivityIcon({ type }: { type: ActivityType }) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "tid_registered":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "tweet":
    case "tweet_reply":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}>
          <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" strokeLinejoin="round" />
        </svg>
      );
    case "reaction_like":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cls}>
          <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
        </svg>
      );
    case "reaction_recast":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}>
          <path d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
        </svg>
      );
    case "bookmark":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}>
          <path d="M6 4h12v17l-6-4-6 4V4z" strokeLinejoin="round" />
        </svg>
      );
    case "dm_sent":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}>
          <path d="M4 6h16v10H8l-4 4V6z" strokeLinejoin="round" />
        </svg>
      );
    case "tip_sent":
    case "tip_received":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9 9h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" strokeLinecap="round" />
        </svg>
      );
    case "follow_pending":
    case "follow_settled":
    case "follow_failed":
    case "unfollow_pending":
    case "unfollow_settled":
    case "unfollow_failed":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={cls}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
        </svg>
      );
  }
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

export default function ActivityCard({ tid }: ActivityCardProps) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchUserActivity(tid)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tid]);

  // Sidebar shows a preview; the dedicated /activity page is the
  // canonical full list (filterable, paginated by limit).
  const visible = rows.slice(0, 8);
  const onChainCount = rows.filter((r) => ON_CHAIN_TYPES.has(r.type)).length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-gray-900">Activity</p>
        <p className="text-[10px] uppercase tracking-wider text-gray-400">
          {onChainCount} on-chain · {rows.length} total
        </p>
      </div>

      {!loaded ? (
        <div className="flex justify-center py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">
          No recorded activity yet. Post a tweet, follow someone, or send a tip
          to start building your on-chain history.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {visible.map((row, i) => {
              const detailLink = tweetLinkFor(row);
              const explorerLink = row.tx_signature
                ? `https://explorer.solana.com/tx/${encodeURIComponent(row.tx_signature)}?cluster=devnet`
                : null;
              const onChain = ON_CHAIN_TYPES.has(row.type);
              return (
                <li
                  key={`${row.type}:${row.target_hash ?? row.peer_tid ?? i}:${row.timestamp}`}
                  className={`rounded-lg border px-2.5 py-2 text-xs ${
                    onChain
                      ? "border-emerald-100 bg-emerald-50/50"
                      : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        onChain ? "bg-emerald-600 text-white" : "bg-gray-700 text-white"
                      }`}
                    >
                      <ActivityIcon type={row.type} />
                    </span>
                    <span className="flex-1 font-medium text-gray-900">
                      {VERB[row.type]}
                    </span>
                    <span className="text-gray-400">{relativeTime(row.timestamp)}</span>
                  </div>
                  {(row.preview || row.peer_tid) && (
                    <p className="mt-1 truncate pl-7 text-gray-600">
                      {row.peer_tid ? `with TID #${row.peer_tid}` : null}
                      {row.peer_tid && row.preview ? " · " : null}
                      {row.preview ?? null}
                    </p>
                  )}
                  {(detailLink || explorerLink) && (
                    <div className="mt-1 flex gap-3 pl-7 text-[11px]">
                      {detailLink && (
                        <Link href={detailLink} className="text-blue-600 hover:underline">
                          View
                        </Link>
                      )}
                      {explorerLink && (
                        <a
                          href={explorerLink}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-emerald-700 hover:underline"
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
          <Link
            href="/activity"
            className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline"
          >
            See all →
          </Link>
        </>
      )}
    </div>
  );
}
