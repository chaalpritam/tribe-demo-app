"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchChannels, fetchChannelFeed } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import TweetCard from "@/components/TweetCard";
import TweetComposer from "@/components/TweetComposer";

export default function ChannelsPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      }
    >
      <ChannelsPage />
    </Suspense>
  );
}

interface Channel {
  channel_id: string;
  tweet_count: number;
  last_active: string;
}

interface Tweet {
  hash?: string;
  tid?: string | number;
  text?: string;
  timestamp?: string | number;
  username?: string | null;
  reply_count?: number;
}

function ChannelsPage() {
  const { connected } = useWallet();
  const searchParams = useSearchParams();
  const router = useRouter();
  const channelId = searchParams.get("id");

  const [channels, setChannels] = useState<Channel[]>([]);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTid, setMyTid] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (channelId) {
          const data = await fetchChannelFeed(channelId);
          setTweets(data?.tweets ?? []);
        } else {
          const data = await fetchChannels();
          setChannels(data?.channels ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [channelId, refreshKey]);

  if (!connected) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-gray-500">Connect your wallet to view channels</p>
      </div>
    );
  }

  // Channel feed view
  if (channelId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <button
          onClick={() => router.push("/channels")}
          className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All channels
        </button>

        <h1 className="text-2xl font-bold text-white">#{channelId}</h1>

        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900">
          {myTid && (
            <TweetComposer
              tid={myTid}
              channelId={channelId}
              placeholder={`Post in #${channelId}...`}
              onTweetPublished={() => setRefreshKey((k) => k + 1)}
            />
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
            </div>
          ) : tweets.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              No posts in this channel yet
            </p>
          ) : (
            tweets.map((tweet, i) => {
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
            })
          )}
        </div>
      </div>
    );
  }

  // Channels list view
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-white">Channels</h1>
      <p className="mt-1 text-sm text-gray-400">
        Browse topic-based channels
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      ) : channels.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">No channels yet.</p>
          <p className="mt-1 text-sm text-gray-600">
            Post a tweet with a channel to create one!
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {channels.map((ch) => (
            <button
              key={ch.channel_id}
              onClick={() => router.push(`/channels?id=${encodeURIComponent(ch.channel_id)}`)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:bg-gray-800/50"
            >
              <div>
                <p className="font-semibold text-white">#{ch.channel_id}</p>
                <p className="text-xs text-gray-500">
                  {ch.tweet_count} {ch.tweet_count === 1 ? "post" : "posts"}
                </p>
              </div>
              <span className="text-xs text-gray-500">
                {getTimeAgo(new Date(ch.last_active))}
              </span>
            </button>
          ))}
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
