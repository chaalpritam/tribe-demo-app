"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchUser, fetchFollowing } from "@/lib/api";
import { erFollow } from "@/lib/er-client";

interface ProfileSidebarProps {
  tid: string;
  walletAddress: string;
}

export default function ProfileSidebar({
  tid,
  walletAddress,
}: ProfileSidebarProps) {
  const { publicKey, signMessage } = useWallet();
  const [username, setUsername] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followingList, setFollowingList] = useState<
    { following_tid: string; username: string | null }[]
  >([]);
  const [followInput, setFollowInput] = useState("");
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const user = await fetchUser(tid);
        setUsername(user?.username ?? null);
        setDisplayName(user?.display_name ?? null);
        setBio(user?.bio ?? null);
        setAvatarUrl(user?.avatar_url ?? null);
        setFollowersCount(
          Number(user?.followers_count ?? user?.follower_count ?? 0)
        );
        setFollowingCount(Number(user?.following_count ?? 0));
      } catch {
        // ignore
      }

      try {
        const data = await fetchFollowing(tid);
        setFollowingList(data?.following ?? []);
      } catch {
        // ignore
      }
    }
    loadProfile();
  }, [tid]);

  const handleFollow = useCallback(async () => {
    if (!publicKey || !signMessage || !followInput.trim()) return;
    const targetTid = parseInt(followInput.trim(), 10);
    if (isNaN(targetTid) || targetTid <= 0) {
      setFollowError("Enter a valid TID number");
      return;
    }
    if (targetTid === parseInt(tid, 10)) {
      setFollowError("Can't follow yourself");
      return;
    }

    setFollowLoading(true);
    setFollowError(null);
    try {
      const myTid = parseInt(tid, 10);
      await erFollow(myTid, targetTid, publicKey.toBase58(), signMessage);
      setFollowInput("");
      setFollowingCount((c) => c + 1);
      setFollowingList((list) => [
        { following_tid: String(targetTid), username: null },
        ...list,
      ]);
    } catch (err) {
      setFollowError(
        err instanceof Error ? err.message : "Failed to follow"
      );
    } finally {
      setFollowLoading(false);
    }
  }, [publicKey, signMessage, tid, followInput]);

  const nameDisplay = displayName ?? (username ? `${username}.tribe` : `TID #${tid}`);

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-lg font-bold text-white">
              {username ? username[0].toUpperCase() : tid}
            </div>
          )}
          <div>
            <p className="font-semibold text-white">{nameDisplay}</p>
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
            <p className="text-lg font-semibold text-white">
              {followersCount}
            </p>
            <p className="text-sm text-gray-500">Followers</p>
          </div>
        </div>
      </div>

      {bio && (
        <p className="mt-3 text-sm text-gray-400">{bio}</p>
      )}

      {/* Follow someone */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <p className="text-sm font-semibold text-white">Follow a user</p>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={followInput}
            onChange={(e) => setFollowInput(e.target.value)}
            placeholder="Enter TID"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-600"
          />
          <button
            onClick={handleFollow}
            disabled={followLoading || !followInput.trim()}
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {followLoading ? "..." : "Follow"}
          </button>
        </div>
        {followError && (
          <p className="mt-1 text-xs text-red-400">{followError}</p>
        )}
      </div>

      {/* Following list */}
      {followingList.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-sm font-semibold text-white">Following</p>
          <div className="mt-2 space-y-2">
            {followingList.slice(0, 10).map((f) => (
              <div
                key={f.following_tid}
                className="flex items-center gap-2 text-sm"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-600/20 text-xs text-purple-400">
                  {f.username
                    ? f.username[0].toUpperCase()
                    : f.following_tid}
                </div>
                <span className="text-gray-300">
                  {f.username
                    ? `${f.username}.tribe`
                    : `TID #${f.following_tid}`}
                </span>
              </div>
            ))}
            {followingList.length > 10 && (
              <p className="text-xs text-gray-500">
                +{followingList.length - 10} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
