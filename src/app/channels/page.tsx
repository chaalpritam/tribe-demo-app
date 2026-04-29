"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchChannels, fetchChannelFeed, fetchJoinedChannels } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import TweetCard from "@/components/TweetCard";
import TweetComposer from "@/components/TweetComposer";
import {
  signAndCreateChannel,
  signAndJoinChannel,
  signAndLeaveChannel,
  ChannelKind,
  type ChannelKindValue,
} from "@/lib/messages";

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

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
  // Hub returns `id` (not `channel_id`) — the slug
  id: string;
  name: string | null;
  description: string | null;
  kind: number | null;
  tweet_count: number;
  member_count: number;
  last_tweet_at: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const [myTid, setMyTid] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  // Set of channel ids the current user has joined. Refreshed alongside
  // the channel list and after each Join/Leave click so the row stays
  // in sync without a full reload.
  const [joined, setJoined] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (channelId) {
          const data = await fetchChannelFeed(channelId);
          setTweets(data?.tweets ?? []);
        } else {
          const [data, joinedData] = await Promise.all([
            fetchChannels(),
            myTid !== null
              ? fetchJoinedChannels(String(myTid))
              : Promise.resolve({ channels: [] }),
          ]);
          setChannels(data?.channels ?? []);
          setJoined(
            new Set((joinedData.channels ?? []).map((c) => c.id)),
          );
        }
      } catch {
        setError("Failed to load channel data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [channelId, refreshKey, myTid]);

  const handleToggleMembership = useCallback(
    async (id: string) => {
      if (myTid === null) return;
      const appKey = loadAppKey();
      if (!appKey) return;
      const wasJoined = joined.has(id);
      // Optimistic flip + local member-count adjust; revert on failure.
      setJoined((prev) => {
        const next = new Set(prev);
        if (wasJoined) next.delete(id);
        else next.add(id);
        return next;
      });
      setChannels((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                member_count: Math.max(
                  0,
                  (c.member_count ?? 0) + (wasJoined ? -1 : 1),
                ),
              }
            : c,
        ),
      );
      try {
        if (wasJoined) {
          await signAndLeaveChannel({ tid: myTid, channelId: id, signingKeySecret: appKey });
        } else {
          await signAndJoinChannel({ tid: myTid, channelId: id, signingKeySecret: appKey });
        }
      } catch (err) {
        console.error("Channel membership toggle failed:", err);
        setJoined((prev) => {
          const next = new Set(prev);
          if (wasJoined) next.add(id);
          else next.delete(id);
          return next;
        });
        setChannels((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  member_count: Math.max(
                    0,
                    (c.member_count ?? 0) + (wasJoined ? 1 : -1),
                  ),
                }
              : c,
          ),
        );
      }
    },
    [myTid, joined],
  );

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
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-gray-500">{error}</p>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="mt-2 text-sm text-purple-400 hover:underline"
              >
                Retry
              </button>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Channels</h1>
          <p className="mt-1 text-sm text-gray-400">
            Browse or create topic-based channels
          </p>
        </div>
        {myTid !== null && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
          >
            + New
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
            onClick={() => setRefreshKey((k) => k + 1)}
            className="mt-2 text-sm text-purple-400 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : channels.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">No channels yet.</p>
          <p className="mt-1 text-sm text-gray-600">
            Click <span className="text-purple-400">+ New</span> to create one,
            or post a tweet with a channel.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {channels.map((ch) => {
            const isJoined = joined.has(ch.id);
            return (
              <div
                key={ch.id}
                className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:bg-gray-800/50"
              >
                <button
                  onClick={() => router.push(`/channels?id=${encodeURIComponent(ch.id)}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">
                      {ch.name ? ch.name : `#${ch.id}`}
                    </p>
                    {ch.name && (
                      <span className="text-xs text-gray-500">#{ch.id}</span>
                    )}
                    {ch.kind === 2 && (
                      <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-400">
                        city
                      </span>
                    )}
                    {isJoined && (
                      <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-purple-300">
                        joined
                      </span>
                    )}
                  </div>
                  {ch.description && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {ch.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {ch.tweet_count} {ch.tweet_count === 1 ? "post" : "posts"}
                    {ch.member_count > 0 && (
                      <> · {ch.member_count} {ch.member_count === 1 ? "member" : "members"}</>
                    )}
                    {ch.last_tweet_at && (
                      <> · last activity {getTimeAgo(new Date(ch.last_tweet_at))}</>
                    )}
                  </p>
                </button>
                {myTid !== null && ch.id !== "general" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleMembership(ch.id);
                    }}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      isJoined
                        ? "border border-gray-700 text-gray-300 hover:border-red-500 hover:text-red-400"
                        : "bg-purple-600 text-white hover:bg-purple-700"
                    }`}
                  >
                    {isJoined ? "Leave" : "Join"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && myTid !== null && (
        <CreateChannelModal
          tid={myTid}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            setRefreshKey((k) => k + 1);
            router.push(`/channels?id=${encodeURIComponent(id)}`);
          }}
        />
      )}
    </div>
  );
}

interface CreateChannelModalProps {
  tid: number;
  onClose: () => void;
  onCreated: (channelId: string) => void;
}

const CHANNEL_ID_RE = /^[a-z0-9-]{1,64}$/;

function CreateChannelModal({ tid, onClose, onCreated }: CreateChannelModalProps) {
  const [channelId, setChannelId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ChannelKindValue>(ChannelKind.INTEREST);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const trimmedId = channelId.trim().toLowerCase();
    if (!CHANNEL_ID_RE.test(trimmedId)) {
      setError("Channel id must be 1–64 chars of a–z, 0–9, or hyphens.");
      return;
    }
    if (trimmedId === "general") {
      setError("\"general\" is reserved.");
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    const appKey = loadAppKey();
    if (!appKey) {
      setError("No app key — register your identity first.");
      return;
    }

    let lat: number | undefined;
    let lon: number | undefined;
    if (kind === ChannelKind.CITY) {
      if (latitude.trim()) {
        const n = Number(latitude);
        if (Number.isFinite(n)) lat = n;
      }
      if (longitude.trim()) {
        const n = Number(longitude);
        if (Number.isFinite(n)) lon = n;
      }
    }

    setSubmitting(true);
    try {
      await signAndCreateChannel({
        tid,
        channelId: trimmedId,
        name: name.trim(),
        description: description.trim() || undefined,
        kind,
        latitude: lat,
        longitude: lon,
        signingKeySecret: appKey,
      });
      onCreated(trimmedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    } finally {
      setSubmitting(false);
    }
  }, [channelId, name, description, kind, latitude, longitude, tid, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New channel</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400">
              Channel id <span className="text-gray-600">(slug, a–z 0–9 hyphens)</span>
            </label>
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="solana-devs"
              maxLength={64}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Solana Developers"
              maxLength={80}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
              className="mt-1 w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">Kind</label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setKind(ChannelKind.INTEREST)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  kind === ChannelKind.INTEREST
                    ? "border-purple-500 bg-purple-500/20 text-purple-200"
                    : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                Interest
              </button>
              <button
                type="button"
                onClick={() => setKind(ChannelKind.CITY)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  kind === ChannelKind.CITY
                    ? "border-green-500 bg-green-500/20 text-green-200"
                    : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                City
              </button>
            </div>
          </div>

          {kind === ChannelKind.CITY && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-400">
                  Latitude
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="37.7749"
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400">
                  Longitude
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="-122.4194"
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-600"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create channel"}
            </button>
          </div>
        </div>
      </div>
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
