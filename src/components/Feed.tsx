"use client";

import { useState, useEffect, useCallback } from "react";
import TweetCard from "./TweetCard";
import { fetchGlobalFeed, fetchFeed, fetchTweets } from "@/lib/api";

interface Tweet {
  hash?: string;
  tid?: string | number;
  text?: string;
  timestamp?: string | number;
  username?: string;
}

interface FeedProps {
  tid?: string;
  refreshKey?: number;
}

export default function Feed({ tid, refreshKey }: FeedProps) {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTweets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      try {
        // Try global feed from indexer first, then tweet server
        data = tid ? await fetchFeed(tid) : await fetchFeed();
      } catch {
        // Fallback to tweet server direct
        data = tid
          ? await fetchTweets(tid)
          : await fetchGlobalFeed();
      }

      const tweetList = Array.isArray(data)
        ? data
        : data?.tweets ?? [];
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

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-gray-500">{error}</p>
        <button
          onClick={loadTweets}
          className="mt-2 text-sm text-purple-400 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (tweets.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-gray-500">No tweets yet. Be the first to post!</p>
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
          />
        );
      })}
    </div>
  );
}
