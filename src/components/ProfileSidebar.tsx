"use client";

import { useState, useEffect } from "react";
import { fetchUser, fetchFollowers, fetchFollowing } from "@/lib/api";

interface ProfileSidebarProps {
  tid: string;
  walletAddress: string;
}

export default function ProfileSidebar({ tid, walletAddress }: ProfileSidebarProps) {
  const [username, setUsername] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    async function loadProfile() {
      try {
        const user = await fetchUser(tid);
        setUsername(user?.username ?? null);
      } catch {
        // User may not exist in indexer yet
      }

      try {
        const followers = await fetchFollowers(tid);
        setFollowersCount(
          Array.isArray(followers)
            ? followers.length
            : followers?.count ?? 0
        );
      } catch {
        // ignore
      }

      try {
        const following = await fetchFollowing(tid);
        setFollowingCount(
          Array.isArray(following)
            ? following.length
            : following?.count ?? 0
        );
      } catch {
        // ignore
      }
    }

    loadProfile();
  }, [tid]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-lg font-bold text-white">
          {tid}
        </div>
        <div>
          <p className="font-semibold text-white">
            {username ?? `TID #${tid}`}
          </p>
          <p className="text-sm text-gray-400" title={walletAddress}>
            {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-6">
        <div>
          <p className="text-lg font-semibold text-white">{followingCount}</p>
          <p className="text-sm text-gray-500">Following</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-white">{followersCount}</p>
          <p className="text-sm text-gray-500">Followers</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-gray-800/50 px-3 py-2">
        <p className="text-xs text-gray-400">TID</p>
        <p className="text-sm font-mono text-purple-400">{tid}</p>
      </div>
    </div>
  );
}
