"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchUser, fetchFeed, fetchFollowers, fetchFollowing, resolveMediaUrl } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import TweetCard from "@/components/TweetCard";
import FollowButton from "@/components/FollowButton";

interface User {
  tid: string;
  custody_address: string;
  recovery_address: string;
  username: string | null;
  registered_at: string;
  following_count: string;
  followers_count: string;
  pfp_url?: string | null;
  profile?: {
    bio?: string;
    displayName?: string;
  };
}

interface Tweet {
  hash?: string;
  tid?: string | number;
  text?: string;
  timestamp?: string | number;
  username?: string | null;
  display_name?: string | null;
  pfp_url?: string | null;
  channel_id?: string;
  embeds?: string[];
  /** Set by /v1/feed/:tid when the row represents a retweet by the
   *  profile owner — the tweet body is the original, and these
   *  fields tell the card to render a "@user retweeted" header. */
  retweeted_by_tid?: string | number | null;
  retweeted_by_username?: string | null;
  retweeted_at?: string | null;
}

interface FollowEntry {
  follower_tid?: string;
  following_tid?: string;
  username: string | null;
  custody_address: string;
  pfp_url?: string | null;
}

export default function ProfilePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
        </div>
      }
    >
      <ProfilePage />
    </Suspense>
  );
}

function ProfilePage() {
  const { connected } = useWallet();
  const searchParams = useSearchParams();
  const tidParam = searchParams.get("tid");

  const [user, setUser] = useState<User | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [followers, setFollowers] = useState<FollowEntry[]>([]);
  const [following, setFollowing] = useState<FollowEntry[]>([]);
  const [tab, setTab] = useState<"tweets" | "followers" | "following">("tweets");
  const [loading, setLoading] = useState(true);
  const [myTid, setMyTid] = useState<number | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    if (!tidParam) return;

    async function load() {
      setLoading(true);
      setImgError(false);
      try {
        const [userData, feedData, followersData, followingData] =
          await Promise.allSettled([
            fetchUser(tidParam!),
            fetchFeed(tidParam!),
            fetchFollowers(tidParam!),
            fetchFollowing(tidParam!),
          ]);

        if (userData.status === "fulfilled") setUser(userData.value);
        if (feedData.status === "fulfilled")
          setTweets(feedData.value?.tweets ?? []);
        if (followersData.status === "fulfilled")
          setFollowers(followersData.value?.followers ?? []);
        if (followingData.status === "fulfilled")
          setFollowing(followingData.value?.following ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tidParam]);

  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Connect your wallet to view profiles</p>
      </div>
    );
  }

  if (!tidParam) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">No TID specified</p>
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

  const tid = parseInt(tidParam, 10);
  const displayName = user?.username
    ? `${user.username}.tribe`
    : `TID #${tidParam}`;
  const initial = user?.username ? user.username[0].toUpperCase() : tidParam;
  const isMe = myTid === tid;

  const resolvedPfp = (user?.pfp_url || (user?.profile as any)?.pfpUrl || (user?.profile as any)?.pfp_url) 
    ? resolveMediaUrl(user?.pfp_url || (user?.profile as any)?.pfpUrl || (user?.profile as any)?.pfp_url) 
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Profile header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-gray-900 text-3xl font-bold text-white shadow-inner ring-4 ring-white">
              {resolvedPfp && !imgError ? (
                <img
                  src={resolvedPfp}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="bg-gradient-to-br from-gray-700 to-gray-900 flex h-full w-full items-center justify-center">
                  {initial}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
                {isMe && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    You
                  </span>
                )}
              </div>
              {user?.custody_address && (
                <div className="mt-1">
                  <WalletAddress address={user.custody_address} />
                </div>
              )}
              {user?.registered_at && (
                <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Joined{" "}
                  {new Date(user.registered_at).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {myTid && !isMe && (
              <>
                <Link
                  href={`/messages?to=${tid}&username=${user?.username ?? ""}`}
                  title="Send message"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition-all hover:border-gray-900 hover:text-gray-900"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />
                  </svg>
                </Link>
                <FollowButton
                  myTid={myTid}
                  targetTid={tid}
                  onToggle={(nowFollowing) => {
                    // Optimistically bump this profile's followers
                    // count — the hub's social_graph row only lands
                    // after L1 settlement (~10s + indexer lag), so
                    // without this the displayed number doesn't move
                    // on the user's screen until the next reload.
                    setUser((u) =>
                      u
                        ? {
                            ...u,
                            followers_count: String(
                              Math.max(
                                0,
                                Number(u.followers_count ?? 0) +
                                  (nowFollowing ? 1 : -1),
                              ),
                            ),
                          }
                        : u,
                    );
                  }}
                />
              </>
            )}
            {isMe && (
              <Link
                href="/settings"
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-all hover:border-gray-900 hover:text-gray-900"
              >
                Edit Profile
              </Link>
            )}
          </div>
        </div>

        {user?.profile?.bio && (
          <p className="mt-6 text-base leading-relaxed text-gray-700">
            {user.profile.bio}
          </p>
        )}

        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {Number(user?.following_count ?? 0)}
            </p>
            <p className="text-sm text-gray-500">Following</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {Number(user?.followers_count ?? 0)}
            </p>
            <p className="text-sm text-gray-500">Followers</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{tweets.length}</p>
            <p className="text-sm text-gray-500">Tweets</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex border-b border-gray-200">
        {(["tweets", "followers", "following"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-center text-sm font-semibold transition-colors ${
              tab === t
                ? "-mb-px border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-2 rounded-xl border border-gray-200 bg-white">
        {tab === "tweets" && (
          <>
            {tweets.length === 0 ? (
              <p className="py-8 text-center text-gray-500">No tweets yet</p>
            ) : (
              tweets.map((tweet, i) => {
                const tweetTimestamp = tweet.timestamp
                  ? typeof tweet.timestamp === "string"
                    ? Math.floor(
                        new Date(tweet.timestamp).getTime() / 1000
                      )
                    : tweet.timestamp
                  : 0;
                // The same original tweet can appear twice in a feed
                // (e.g. user posted AND retweeted the same hash) — key
                // on the (action, hash) pair so React doesn't collide.
                const isRetweet = tweet.retweeted_by_tid != null;
                const rowKey = `${isRetweet ? "rt" : "tw"}:${tweet.hash ?? i}`;
                return (
                  <TweetCard
                    key={rowKey}
                    text={tweet.text ?? ""}
                    tid={Number(tweet.tid ?? 0)}
                    timestamp={tweetTimestamp}
                    hash={tweet.hash}
                    username={tweet.username ?? undefined}
                    displayName={tweet.display_name ?? undefined}
                    pfpUrl={tweet.pfp_url ?? user?.pfp_url ?? undefined}
                    myTid={myTid ?? undefined}
                    channelId={tweet.channel_id}
                    embeds={tweet.embeds}
                    retweetedByTid={
                      tweet.retweeted_by_tid != null
                        ? Number(tweet.retweeted_by_tid)
                        : undefined
                    }
                    retweetedByUsername={tweet.retweeted_by_username ?? undefined}
                  />
                );
              })
            )}
          </>
        )}

        {tab === "followers" && (
          <>
            {followers.length === 0 ? (
              <p className="py-8 text-center text-gray-500">No followers yet</p>
            ) : (
              followers.map((f) => (
                <UserRow
                  key={f.follower_tid}
                  tid={f.follower_tid!}
                  username={f.username}
                  address={f.custody_address}
                  pfpUrl={f.pfp_url || (f as any).profile?.pfpUrl || (f as any).profile?.pfp_url}
                  myTid={myTid}
                />
              ))
            )}
          </>
        )}

        {tab === "following" && (
          <>
            {following.length === 0 ? (
              <p className="py-8 text-center text-gray-500">
                Not following anyone yet
              </p>
            ) : (
              following.map((f) => (
                <UserRow
                  key={f.following_tid}
                  tid={f.following_tid!}
                  username={f.username}
                  address={f.custody_address}
                  pfpUrl={f.pfp_url || (f as any).profile?.pfpUrl || (f as any).profile?.pfp_url}
                  myTid={myTid}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

function WalletAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <button
      onClick={handleCopy}
      className="mt-1 flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
      title="Copy wallet address"
    >
      <svg
        className="h-3 w-3 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
        />
      </svg>
      <span className="font-mono">
        {address.slice(0, 4)}...{address.slice(-4)}
      </span>
      {copied && (
        <span className="text-green-600">Copied!</span>
      )}
    </button>
  );
}

function UserRow({
  tid,
  username,
  address,
  pfpUrl,
  myTid,
}: {
  tid: string;
  username: string | null;
  address: string;
  pfpUrl?: string | null;
  myTid: number | null;
}) {
  const [imgError, setImgError] = useState(false);
  const displayName = username ? `${username}.tribe` : `TID #${tid}`;
  const initial = (username || tid)[0].toUpperCase();
  const tidNum = parseInt(tid, 10);
  const isMe = myTid === tidNum;
  const resolvedPfp = pfpUrl ? resolveMediaUrl(pfpUrl) : null;

  return (
    <a
      href={`/profile?tid=${tid}`}
      className="flex items-center justify-between border-b border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-900 text-sm font-semibold text-white shadow-inner ring-2 ring-white transition-transform group-hover:scale-105">
          {resolvedPfp && !imgError ? (
            <img
              src={resolvedPfp}
              alt={displayName}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="bg-gradient-to-br from-gray-700 to-gray-900 flex h-full w-full items-center justify-center">
              {initial}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{displayName}</p>
          <p className="text-xs text-gray-500">
            {address.slice(0, 4)}...{address.slice(-4)}
          </p>
        </div>
      </div>
      {myTid && !isMe && (
        <FollowButton myTid={myTid} targetTid={tidNum} />
      )}
    </a>
  );
}
