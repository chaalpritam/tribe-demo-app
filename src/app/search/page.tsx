"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { searchTweets } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import TweetCard from "@/components/TweetCard";

export default function SearchPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      }
    >
      <SearchPage />
    </Suspense>
  );
}

interface Tweet {
  hash?: string;
  tid?: string | number;
  text?: string;
  timestamp?: string | number;
  username?: string | null;
  reply_count?: number;
}

function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTid, setMyTid] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setTweets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchTweets(query)
      .then((data) => setTweets(data?.tweets ?? []))
      .catch(() => setTweets([]))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-white">
        Search: &ldquo;{query}&rdquo;
      </h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      ) : tweets.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">
          No results found for &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900">
          {tweets.map((tweet, i) => {
            const ts =
              typeof tweet.timestamp === "string"
                ? Math.floor(new Date(tweet.timestamp).getTime() / 1000)
                : (tweet.timestamp ?? 0);
            return (
              <TweetCard
                key={tweet.hash ?? i}
                text={tweet.text ?? ""}
                tid={Number(tweet.tid ?? 0)}
                timestamp={ts}
                hash={tweet.hash}
                username={tweet.username ?? undefined}
                myTid={myTid ?? undefined}
                replyCount={tweet.reply_count}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
