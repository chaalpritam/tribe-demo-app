"use client";

import { useState, useEffect, useCallback } from "react";
import TweetCard from "./TweetCard";
import { fetchGlobalFeed, fetchFeed, fetchTweets } from "@/lib/api";
import { onFeedUpdate } from "@/lib/ws";

interface Tweet {
  hash?: string;
  tid?: string | number;
  text?: string;
  timestamp?: string | number;
  username?: string | null;
  reply_count?: number;
  embeds?: string[];
}

interface FeedProps {
  tid?: string;
  myTid?: number;
  refreshKey?: number;
}

export default function Feed({ tid, myTid, refreshKey }: FeedProps) {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTweets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      try {
        data = tid ? await fetchFeed(tid) : await fetchFeed();
      } catch {
        data = tid ? await fetchTweets(tid) : await fetchGlobalFeed();
      }

      const tweetList = Array.isArray(data) ? data : data?.tweets ?? [];
      setTweets(tweetList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [tid]);

  useEffect(() => {
    loadTweets();
  }, [loadTweets, refreshKey]);

  // Real-time updates via WebSocket, fallback to 60s polling
  useEffect(() => {
    const unsub = onFeedUpdate((event) => {
      if (event === "new_message" || event === "new_tweet") {
        loadTweets();
      }
    });
    const interval = setInterval(loadTweets, 60000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [loadTweets]);

  if (loading && tweets.length === 0) {
    return (
      <div className="space-y-3 px-4 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && tweets.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-gray-500">{error}</p>
        <button
          onClick={loadTweets}
          className="mt-2 text-sm font-semibold text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tweets.length === 0) {
    return (
      <div className="px-4 py-14 text-center">
        <p className="text-sm font-semibold text-gray-900">It&apos;s quiet here</p>
        <p className="mt-1 text-sm text-gray-500">
          Post the first tweet — your followers will see it instantly.
        </p>
      </div>
    );
  }

  return (
    <div>
      {tweets.map((tweet, i) => {
        const tweetTid = tweet.tid ?? 0;
        const tweetText = tweet.text ?? "";
        const tweetTimestamp = tweet.timestamp
          ? typeof tweet.timestamp === "string"
            ? Math.floor(new Date(tweet.timestamp).getTime() / 1000)
            : tweet.timestamp
          : 0;

        return (
          <TweetCard
            key={tweet.hash ?? i}
            text={tweetText}
            tid={Number(tweetTid)}
            timestamp={tweetTimestamp}
            hash={tweet.hash}
            username={tweet.username ?? undefined}
            myTid={myTid}
            replyCount={tweet.reply_count}
            embeds={tweet.embeds}
          />
        );
      })}
    </div>
  );
}
