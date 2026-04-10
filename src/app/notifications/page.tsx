"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchNotifications, markNotificationsRead } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";

interface Notification {
  id: number;
  tid: string;
  type: "follow" | "like" | "reply" | "mention";
  from_tid: string | null;
  from_username: string | null;
  tweet_hash: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_LABELS = {
  follow: "followed you",
  like: "liked your tweet",
  reply: "replied to your tweet",
  mention: "mentioned you",
};

const TYPE_ICONS = {
  follow: "👤",
  like: "❤️",
  reply: "💬",
  mention: "@",
};

export default function NotificationsPage() {
  const { connected } = useWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTid, setMyTid] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(stored);
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

  const handleMarkAllRead = async () => {
    if (!myTid) return;
    await markNotificationsRead(myTid);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
        <h1 className="text-2xl font-bold text-white">Notifications</h1>
        {notifications.some((n) => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-purple-400 hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="py-12 text-center">
          <p className="text-gray-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-purple-400 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">No notifications yet</p>
      ) : (
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900">
          {notifications.map((n) => {
            const fromName = n.from_username
              ? `${n.from_username}.tribe`
              : n.from_tid
              ? `TID #${n.from_tid}`
              : "Someone";

            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 border-b border-gray-800 px-4 py-3 ${
                  !n.read ? "bg-purple-900/10" : ""
                }`}
              >
                <span className="mt-0.5 text-lg">
                  {TYPE_ICONS[n.type]}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-gray-200">
                    <Link
                      href={`/profile?tid=${n.from_tid}`}
                      className="font-semibold text-white hover:underline"
                    >
                      {fromName}
                    </Link>{" "}
                    {TYPE_LABELS[n.type]}
                  </p>
                  {n.tweet_hash && (
                    <Link
                      href={`/tweet?hash=${encodeURIComponent(n.tweet_hash)}`}
                      className="mt-1 block text-xs text-purple-400 hover:underline"
                    >
                      View tweet
                    </Link>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {getTimeAgo(new Date(n.created_at))}
                  </p>
                </div>
                {!n.read && (
                  <div className="mt-1 h-2 w-2 rounded-full bg-purple-500" />
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
