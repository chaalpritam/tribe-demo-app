"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchUsers } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import FollowButton from "@/components/FollowButton";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";

interface User {
  tid: string;
  custody_address: string;
  username: string | null;
  registered_at: string;
  following_count: string;
  followers_count: string;
}

export default function ExplorePage() {
  const { connected } = useWallet();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTid, setMyTid] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchUsers();
        setUsers(data?.users ?? []);
      } catch {
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Connect your wallet to explore users</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title="Explore"
        subtitle="Discover people on the Tribe network"
      />

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState
          title="Couldn't load users"
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
      ) : users.length === 0 ? (
        <EmptyState
          title="No users yet"
          body="Be the first to register a Tribe identity."
        />
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const tid = parseInt(user.tid, 10);
            const displayName = user.username
              ? `${user.username}.tribe`
              : `TID #${user.tid}`;
            const initial = user.username
              ? user.username[0].toUpperCase()
              : user.tid;
            const isMe = myTid === tid;

            return (
              <div
                key={user.tid}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:bg-gray-50"
              >
                <div
                  className="flex cursor-pointer items-center gap-3"
                  onClick={() => router.push(`/profile?tid=${user.tid}`)}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                    {initial}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {displayName}
                      {isMe && (
                        <span className="ml-2 text-xs text-gray-500">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {user.custody_address.slice(0, 4)}...
                      {user.custody_address.slice(-4)}
                      {" · "}
                      {Number(user.followers_count)} followers
                      {" · "}
                      {Number(user.following_count)} following
                    </p>
                  </div>
                </div>

                {myTid && !isMe && (
                  <FollowButton myTid={myTid} targetTid={tid} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
