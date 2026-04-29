"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchNotifications } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";

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
  | "crowdfund_pledge";

interface Notification {
  type: NotificationType;
  actor_tid: string;
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
};

const TYPE_ICONS: Record<NotificationType, string> = {
  follow: "👤",
  reaction: "❤️",
  reply: "💬",
  tip: "💸",
  mention: "@",
  poll_vote: "📊",
  event_rsvp: "📅",
  task_claim: "🛠",
  task_complete: "✅",
  crowdfund_pledge: "🪙",
};

// Tweet-anchored types link to /tweet?hash=…; everything else stays on the
// notifications screen (no dedicated detail routes for poll/event/task/etc).
const TWEET_HASH_TYPES: NotificationType[] = ["reaction", "reply", "tip", "mention"];

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

  if (!connected) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-gray-500">Connect your wallet to view notifications</p>
      </div>
    );
  }

  return (
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
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
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
            const fromName = n.actor_tid ? `TID #${n.actor_tid}` : "Someone";
            const tweetLink =
              TWEET_HASH_TYPES.includes(n.type) && n.target_hash
                ? `/tweet?hash=${encodeURIComponent(n.target_hash)}`
                : null;

            return (
              <div
                key={`${n.type}-${n.actor_tid}-${n.target_hash ?? ""}-${n.created_at}-${idx}`}
                className={`flex items-start gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 ${
                  unread ? "bg-blue-50/40" : ""
                }`}
              >
                <span className="mt-0.5 text-lg">{TYPE_ICONS[n.type]}</span>
                <div className="flex-1 min-w-0">
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
                  {tweetLink && (
                    <Link
                      href={tweetLink}
                      className="mt-1 block text-xs text-blue-600 hover:underline"
                    >
                      View tweet
                    </Link>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {getTimeAgo(new Date(n.created_at))}
                  </p>
                </div>
                {unread && (
                  <div className="mt-1 h-2 w-2 rounded-full bg-blue-500" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
