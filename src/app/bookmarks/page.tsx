"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchBookmarks } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import TweetCard from "@/components/TweetCard";

interface Bookmark {
  tweet_hash: string;
  tweet_tid: string;
  text: string;
  timestamp: string;
  embeds: string[];
  username: string | null;
  created_at: string;
}

export default function BookmarksPage() {
  const { connected } = useWallet();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTid, setMyTid] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    if (!myTid) return;
    setLoading(true);
    setError(null);
    fetchBookmarks(String(myTid))
      .then((data) => setBookmarks(data?.bookmarks ?? []))
      .catch(() => setError("Failed to load bookmarks"))
      .finally(() => setLoading(false));
  }, [myTid]);

  if (!connected) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-gray-500">Connect your wallet to view bookmarks</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-white">Bookmarks</h1>

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
      ) : bookmarks.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">No bookmarks yet</p>
      ) : (
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900">
          {bookmarks.map((b) => (
            <TweetCard
              key={b.tweet_hash}
              text={b.text}
              tid={Number(b.tweet_tid)}
              timestamp={Math.floor(new Date(b.timestamp).getTime() / 1000)}
              hash={b.tweet_hash}
              username={b.username ?? undefined}
              myTid={myTid ?? undefined}
              embeds={b.embeds}
            />
          ))}
        </div>
      )}
    </div>
  );
}
