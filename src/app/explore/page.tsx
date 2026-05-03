"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchUsers, resolveMediaUrl } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import FollowButton from "@/components/FollowButton";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import ConnectionRequired from "@/components/ConnectionRequired";

interface User {
  tid: string;
  custody_address: string;
  username: string | null;
  registered_at: string;
  following_count: string;
  followers_count: string;
  pfp_url?: string | null;
}

function ExploreUserCard({ 
  user, 
  myTid, 
  onNavigate 
}: { 
  user: User, 
  myTid: number | null, 
  onNavigate: (tid: string) => void 
}) {
  const [imgError, setImgError] = useState(false);
  const tid = parseInt(user.tid, 10);
  const displayName = user.username
    ? `${user.username}.tribe`
    : `TID #${user.tid}`;
  const initial = (user.username || user.tid)[0].toUpperCase();
  const isMe = myTid === tid;
  const resolvedPfp = user.pfp_url ? resolveMediaUrl(user.pfp_url) : null;

  return (
    <div className="group relative flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm">
      <div
        className="flex cursor-pointer items-center gap-4"
        onClick={() => onNavigate(user.tid)}
      >
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-900 text-lg font-bold text-white shadow-inner ring-2 ring-white transition-transform group-hover:scale-105">
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
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold text-gray-900">
              {displayName}
            </p>
            {isMe && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                You
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs font-medium text-gray-500">
            {user.custody_address.slice(0, 6)}...
            {user.custody_address.slice(-6)}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-gray-400">
            <span className="flex items-center gap-1">
              <span className="text-gray-900">{Number(user.followers_count)}</span> Followers
            </span>
            <span className="h-1 w-1 rounded-full bg-gray-300" />
            <span className="flex items-center gap-1">
              <span className="text-gray-900">{Number(user.following_count)}</span> Following
            </span>
          </div>
        </div>
      </div>

      <div className="ml-4 shrink-0">
        {myTid && !isMe && (
          <FollowButton myTid={myTid} targetTid={tid} />
        )}
      </div>
    </div>
  );
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

  return (
    <ConnectionRequired 
      title="Explore" 
      description="Connect your wallet to discover new people and communities on Tribe."
    >
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
        <div className="space-y-4">
          {users.map((user) => (
            <ExploreUserCard 
              key={user.tid} 
              user={user} 
              myTid={myTid} 
              onNavigate={(tid) => router.push(`/profile?tid=${tid}`)} 
            />
          ))}
        </div>
      )}
    </div>
    </ConnectionRequired>
  );
}
