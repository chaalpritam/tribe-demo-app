"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchBookmarks } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import TweetCard from "@/components/TweetCard";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";

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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Connect your wallet to view bookmarks</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title="Bookmarks"
        subtitle="Tweets you saved for later"
      />

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState
          title="Couldn't load bookmarks"
          body={error}
          action={
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Retry
            </button>
          }
        />
      ) : bookmarks.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
              <path d="M6 4h12v17l-6-4-6 4V4z" strokeLinejoin="round" />
            </svg>
          }
          title="No bookmarks yet"
          body="Tap the bookmark icon on any tweet to save it here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
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
