"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchNotifications, resolveMediaUrl } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import ConnectionRequired from "@/components/ConnectionRequired";

type NotificationType =
  | "follow"
  | "reaction"
  | "reply"
  | "tip"
  | "mention"
  | "poll_vote"
  | "event_rsvp"
  | "task_claim"
  | "task_complete"
  | "crowdfund_pledge"
  | "dm"
  | "dm_group";

interface Notification {
  type: NotificationType;
  actor_tid: string;
  actor_username?: string | null;
  actor_pfp_url?: string | null;
  target_hash: string | null;
  preview: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<NotificationType, string> = {
  follow: "followed you",
  reaction: "reacted to your tweet",
  reply: "replied to your tweet",
  tip: "tipped you",
  mention: "mentioned you",
  poll_vote: "voted on your poll",
  event_rsvp: "RSVPed to your event",
  task_claim: "claimed your task",
  task_complete: "completed your task",
  crowdfund_pledge: "pledged to your crowdfund",
  dm: "sent you a message",
  dm_group: "messaged your group",
};

function NotifIcon({ type }: { type: NotificationType }) {
  const common = "h-4 w-4";
  switch (type) {
    case "follow":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" />
        </svg>
      );
    case "reaction":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={common}>
          <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
        </svg>
      );
    case "reply":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" strokeLinejoin="round" />
        </svg>
      );
    case "tip":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9 9h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" strokeLinecap="round" />
        </svg>
      );
    case "mention":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M16 12v1a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" strokeLinecap="round" />
        </svg>
      );
    case "poll_vote":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <rect x="4" y="11" width="3" height="9" rx="1" />
          <rect x="10.5" y="7" width="3" height="13" rx="1" />
          <rect x="17" y="14" width="3" height="6" rx="1" />
        </svg>
      );
    case "event_rsvp":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <rect x="4" y="6" width="16" height="14" rx="2" />
          <path d="M4 10h16M9 4v4M15 4v4" strokeLinecap="round" />
        </svg>
      );
    case "task_claim":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <path d="M5 7l2 2 4-4M5 17l2 2 4-4M14 7h6M14 17h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "task_complete":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "crowdfund_pledge":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" strokeLinecap="round" />
        </svg>
      );
    case "dm":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <path d="M4 6h16v10H8l-4 4V6z" strokeLinejoin="round" />
        </svg>
      );
    case "dm_group":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={common}>
          <path d="M3 7h13v8H8l-3 3V7z" strokeLinejoin="round" />
          <path d="M9 4h12v8" strokeLinejoin="round" />
        </svg>
      );
  }
}

// Tweet-anchored types link to /tweet?hash=…; everything else stays on the
// notifications screen (no dedicated detail routes for poll/event/task/etc).
const TWEET_HASH_TYPES: NotificationType[] = ["reaction", "reply", "tip", "mention"];

// Resolve the per-row link target. Tweet-anchored notifications open
// the tweet detail; DMs jump straight into the conversation; group
// DMs into the group view. Everything else has no detail route.
function notificationLink(n: { type: NotificationType; target_hash: string | null }): string | null {
  if (!n.target_hash) return null;
  if (TWEET_HASH_TYPES.includes(n.type)) {
    return `/tweet?hash=${encodeURIComponent(n.target_hash)}`;
  }
  if (n.type === "dm") {
    return `/messages?conv=${encodeURIComponent(n.target_hash)}`;
  }
  if (n.type === "dm_group") {
    return `/messages?group=${encodeURIComponent(n.target_hash)}`;
  }
  return null;
}

const LAST_SEEN_KEY_PREFIX = "tribe.notifications.lastSeen.";

export default function NotificationsPage() {
  const { connected } = useWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTid, setMyTid] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<number>(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) {
      setMyTid(stored);
      const seen = localStorage.getItem(LAST_SEEN_KEY_PREFIX + stored);
      setLastSeen(seen ? Number(seen) : 0);
    }
  }, []);

  useEffect(() => {
    if (!myTid) return;
    setLoading(true);
    setError(null);
    fetchNotifications(myTid)
      .then((data) => setNotifications(data?.notifications ?? []))
      .catch(() => setError("Failed to load notifications"))
      .finally(() => setLoading(false));
  }, [myTid]);

  const hasUnread = useMemo(
    () => notifications.some((n) => new Date(n.created_at).getTime() > lastSeen),
    [notifications, lastSeen]
  );

  const handleMarkAllRead = () => {
    if (!myTid) return;
    const now = Date.now();
    localStorage.setItem(LAST_SEEN_KEY_PREFIX + myTid, String(now));
    setLastSeen(now);
  };

  return (
    <ConnectionRequired 
      title="Notifications" 
      description="Connect your wallet to see your notifications and social activity."
    >
      <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        {hasUnread && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-blue-600 hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-gray-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">No notifications yet</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {notifications.map((n, idx) => {
            const ts = new Date(n.created_at).getTime();
            const unread = ts > lastSeen;
            const fromName = n.actor_username ? `${n.actor_username}.tribe` : `TID #${n.actor_tid}`;
            const initial = (n.actor_username || n.actor_tid)[0].toUpperCase();
            const detailLink = notificationLink(n);
            const detailLabel =
              n.type === "dm"
                ? "Open conversation"
                : n.type === "dm_group"
                  ? "Open group"
                  : "View tweet";

            return (
              <div
                key={`${n.type}-${n.actor_tid}-${n.target_hash ?? ""}-${n.created_at}-${idx}`}
                className={`flex items-start gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 ${
                  unread ? "bg-gray-50" : ""
                }`}
              >
                <Link
                  href={`/profile?tid=${n.actor_tid}`}
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-900 text-xs font-bold text-white shadow-sm"
                >
                  {n.actor_pfp_url ? (
                    <img
                      src={resolveMediaUrl(n.actor_pfp_url) ?? ""}
                      alt={fromName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{initial}</span>
                  )}
                  <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-gray-900 shadow-sm ring-1 ring-gray-100">
                    <NotifIcon type={n.type} />
                  </div>
                </Link>
                <div className="flex-1 min-w-0 ml-1">
                  <p className="text-sm text-gray-800">
                    <Link
                      href={`/profile?tid=${n.actor_tid}`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {fromName}
                    </Link>{" "}
                    {TYPE_LABELS[n.type]}
                  </p>
                  {n.preview && (
                    <p className="mt-1 truncate text-xs text-gray-600">
                      {n.preview}
                    </p>
                  )}
                  {detailLink && (
                    <Link
                      href={detailLink}
                      className="mt-1 block text-xs text-blue-600 hover:underline"
                    >
                      {detailLabel}
                    </Link>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {getTimeAgo(new Date(n.created_at))}
                  </p>
                </div>
                {unread && (
                  <div className="mt-1 h-2 w-2 rounded-full bg-gray-900" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </ConnectionRequired>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
