"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchTweet, fetchReplies } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import TweetCard from "@/components/TweetCard";
import TweetComposer from "@/components/TweetComposer";

export default function TweetPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
        </div>
      }
    >
      <TweetPage />
    </Suspense>
  );
}

interface Tweet {
  hash: string;
  tid: string | number;
  text: string;
  timestamp: string | number;
  parent_hash?: string | null;
  username?: string | null;
  reply_count?: number;
}

function TweetPage() {
  const { connected } = useWallet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hash = searchParams.get("hash");

  const [tweet, setTweet] = useState<Tweet | null>(null);
  const [replies, setReplies] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTid, setMyTid] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  const loadTweet = useCallback(async () => {
    if (!hash) return;
    setLoading(true);
    try {
      const [tweetData, repliesData] = await Promise.allSettled([
        fetchTweet(hash),
        fetchReplies(hash),
      ]);
      if (tweetData.status === "fulfilled") setTweet(tweetData.value);
      if (repliesData.status === "fulfilled")
        setReplies(repliesData.value?.replies ?? []);
    } finally {
      setLoading(false);
    }
  }, [hash]);

  useEffect(() => {
    loadTweet();
  }, [loadTweet, refreshKey]);

  if (!hash) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">No tweet specified</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
      </div>
    );
  }

  if (!tweet) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Tweet not found</p>
      </div>
    );
  }

  const tweetTimestamp =
    typeof tweet.timestamp === "string"
      ? Math.floor(new Date(tweet.timestamp).getTime() / 1000)
      : tweet.timestamp;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Main tweet */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <TweetCard
          text={tweet.text}
          tid={Number(tweet.tid)}
          timestamp={tweetTimestamp}
          hash={tweet.hash}
          username={tweet.username ?? undefined}
          myTid={myTid ?? undefined}
        />

        {/* Reply composer */}
        {connected && myTid && (
          <TweetComposer
            tid={myTid}
            parentHash={tweet.hash}
            compact
            onTweetPublished={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-500">
            {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
          </h3>
          <div className="rounded-xl border border-gray-200 bg-white">
            {replies.map((reply, i) => {
              const ts =
                typeof reply.timestamp === "string"
                  ? Math.floor(new Date(reply.timestamp).getTime() / 1000)
                  : reply.timestamp;
              return (
                <TweetCard
                  key={reply.hash ?? i}
                  text={reply.text}
                  tid={Number(reply.tid)}
                  timestamp={ts}
                  hash={reply.hash}
                  username={reply.username ?? undefined}
                  myTid={myTid ?? undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {replies.length === 0 && !loading && (
        <p className="mt-6 text-center text-sm text-gray-500">
          No replies yet. Be the first to reply!
        </p>
      )}
    </div>
  );
}
