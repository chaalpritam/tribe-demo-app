"use client";

import { useState, useEffect } from "react";
import { fetchBookmarks } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import TweetCard from "@/components/TweetCard";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConnectionRequired from "@/components/ConnectionRequired";

interface Bookmark {
  tweet_hash: string;
  tweet_tid: string;
  text: string;
  timestamp: string;
  embeds: string[];
  username: string | null;
  display_name?: string | null;
  pfp_url?: string | null;
  created_at: string;
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTid, setMyTid] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (!stored) {
      setLoading(false);
      return;
    }
    const tid = parseInt(stored, 10);
    setMyTid(tid);
    setError(null);
    fetchBookmarks(String(tid))
      .then((data) => setBookmarks(data?.bookmarks ?? []))
      .catch(() => setError("Failed to load bookmarks"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ConnectionRequired
      title="Bookmarks"
      description="Connect your wallet to view tweets you've saved for later."
    >
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
          {bookmarks.map((b, i) => {
            const tweetHash = b.tweet_hash || (b as any).hash || (b as any).target_hash;
            const tweetTid = b.tweet_tid || (b as any).tid || (b as any).target_tid || (b as any).author_tid;
            const tweetUsername = b.username || (b as any).author_username || (b as any).tweet_username || (b as any).profile?.username;
            const tweetDisplayName = b.display_name || (b as any).author_display_name || (b as any).tweet_display_name || (b as any).profile?.displayName;
            const tweetPfpUrl = b.pfp_url || (b as any).author_pfp_url || (b as any).tweet_pfp_url || (b as any).profile?.pfpUrl || (b as any).profile?.pfp_url;
            
            const timestamp = b.timestamp 
              ? Math.floor(new Date(b.timestamp).getTime() / 1000)
              : 0;

            return (
              <TweetCard
                key={tweetHash ?? i}
                text={b.text}
                tid={Number(tweetTid)}
                timestamp={timestamp}
                hash={tweetHash}
                username={tweetUsername ?? undefined}
                displayName={tweetDisplayName ?? undefined}
                pfpUrl={tweetPfpUrl ?? undefined}
                myTid={myTid ?? undefined}
                embeds={b.embeds}
              />
            );
          })}
        </div>
      )}
    </div>
    </ConnectionRequired>
  );
}
