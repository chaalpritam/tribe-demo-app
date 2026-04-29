"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchUser, fetchFeed, fetchFollowers, fetchFollowing } from "@/lib/api";
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
}

interface Tweet {
  hash?: string;
  tid?: string | number;
  text?: string;
  timestamp?: string | number;
  username?: string | null;
}

interface FollowEntry {
  follower_tid?: string;
  following_tid?: string;
  username: string | null;
  custody_address: string;
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

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    if (!tidParam) return;

    async function load() {
      setLoading(true);
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Profile header */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-2xl font-bold text-white">
              {initial}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
              {user?.custody_address && (
                <WalletAddress address={user.custody_address} />
              )}
              {user?.registered_at && (
                <p className="mt-1 text-xs text-gray-500">
                  Joined{" "}
                  {new Date(user.registered_at).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>

          {myTid && !isMe && (
            <FollowButton myTid={myTid} targetTid={tid} />
          )}
          {isMe && (
            <span className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500">
              Your profile
            </span>
          )}
        </div>

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
                return (
                  <TweetCard
                    key={tweet.hash ?? i}
                    text={tweet.text ?? ""}
                    tid={Number(tweet.tid ?? 0)}
                    timestamp={tweetTimestamp}
                    hash={tweet.hash}
                    username={tweet.username ?? undefined}
                    myTid={myTid ?? undefined}
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
  myTid,
}: {
  tid: string;
  username: string | null;
  address: string;
  myTid: number | null;
}) {
  const displayName = username ? `${username}.tribe` : `TID #${tid}`;
  const initial = username ? username[0].toUpperCase() : tid;
  const tidNum = parseInt(tid, 10);
  const isMe = myTid === tidNum;

  return (
    <a
      href={`/profile?tid=${tid}`}
      className="flex items-center justify-between border-b border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
          {initial}
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
