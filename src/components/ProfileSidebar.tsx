"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  fetchUser,
  fetchFollowing,
  fetchKarma,
  fetchUsers,
  resolveMediaUrl,
  type KarmaSummary,
} from "@/lib/api";
import { erFollow } from "@/lib/er-client";
import LogoutButton from "./LogoutButton";
import FollowButton from "./FollowButton";

import WalletButton from "./WalletButton";

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
  const [karma, setKarma] = useState<KarmaSummary | null>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const user = await fetchUser(tid);
        setUsername(user?.username ?? null);
        const profile = (user?.profile ?? {}) as Record<string, any>;
        setDisplayName(profile.displayName ?? null);
        setBio(profile.bio ?? null);
        // Prefer top-level pfp_url, fallback to profile fields (both camelCase and snake_case)
        setAvatarUrl(user?.pfp_url ?? profile.pfpUrl ?? profile.pfp_url ?? null);
        setImgError(false); // Reset error state on new profile
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

      try {
        const k = await fetchKarma(tid);
        if (k) setKarma(k);
      } catch {
        // ignore
      }
    }
    loadProfile();
  }, [tid]);

  useEffect(() => {
    setLoadingSuggestions(true);
    fetchUsers()
      .then((data) => {
        // Filter out self and already following
        const filtered = (data?.users ?? [])
          .filter((u: any) => u.tid !== tid && !followingList.some(f => f.following_tid === u.tid))
          .slice(0, 3);
        setSuggestedUsers(filtered);
      })
      .catch(() => {})
      .finally(() => setLoadingSuggestions(false));
  }, [tid, followingList]);

  const [imgError, setImgError] = useState(false);

  const initial = (displayName || username || tid)[0].toUpperCase();
  const nameDisplay = displayName ?? (username ? `${username}.tribe` : `TID #${tid}`);
  const resolvedAvatar = avatarUrl ? resolveMediaUrl(avatarUrl) : null;

  return (
    <div className="space-y-4">
      {/* Wallet card — sits above profile details */}
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <WalletButton className="w-full justify-center" label="Login / Connect" />
        <LogoutButton />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-900 text-lg font-bold text-white shadow-inner ring-2 ring-white">
            {resolvedAvatar && !imgError ? (
              <img
                src={resolvedAvatar}
                alt="User avatar"
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
            <p className="truncate text-base font-bold text-gray-900">{nameDisplay}</p>
            <p className="text-xs text-gray-500 font-mono" title={walletAddress}>
              {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-lg font-semibold text-gray-900">{followingCount}</p>
            <p className="text-sm text-gray-600">Following</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {followersCount}
            </p>
            <p className="text-sm text-gray-600">Followers</p>
          </div>
          {karma && (
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {karma.total.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                Karma · L{karma.level}
              </p>
            </div>
          )}
        </div>

        {bio && (
          <p className="mt-3 text-sm text-gray-600">{bio}</p>
        )}

        {karma && (
          <details className="mt-3 group">
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
              Karma breakdown
            </summary>
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <KarmaRow label="Tweets" count={karma.breakdown.tweets} weight={karma.weights.tweet} />
              <KarmaRow label="Reactions received" count={karma.breakdown.reactions_received} weight={karma.weights.reactionReceived} />
              <KarmaRow label="Followers" count={karma.breakdown.followers} weight={karma.weights.follower} />
              <KarmaRow label="Tips received" count={karma.breakdown.tips_received} weight={karma.weights.tipReceived} />
              <KarmaRow label="Tasks completed" count={karma.breakdown.tasks_completed} weight={karma.weights.taskCompleted} />
            </div>
          </details>
        )}
      </div>

      {/* Who to follow */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">Who to follow</p>
        <div className="mt-4 space-y-3">
          {loadingSuggestions ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
            </div>
          ) : suggestedUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center">
              <p className="text-xs text-gray-400">No new suggestions</p>
            </div>
          ) : (
            suggestedUsers.map((u) => (
              <div 
                key={u.tid} 
                className="group relative flex flex-col gap-3 rounded-2xl border border-gray-50 bg-white p-3 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-900 text-xs font-bold text-white shadow-inner ring-2 ring-white transition-transform group-hover:scale-105">
                      {u.pfp_url ? (
                        <img
                          src={resolveMediaUrl(u.pfp_url) ?? ""}
                          alt={u.username ?? u.tid}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="bg-gradient-to-br from-gray-700 to-gray-900 flex h-full w-full items-center justify-center">
                          {(u.username || u.tid)[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {u.username ? `${u.username}.tribe` : `TID #${u.tid}`}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                        TID #{u.tid}
                      </p>
                    </div>
                  </div>
                  <FollowButton
                    targetTid={Number(u.tid)}
                    myTid={Number(tid)}
                    onToggle={(nowFollowing) => {
                      // The hub's social_graph row only shows up
                      // after L1 settlement, so without this the
                      // count under "Following" on the sidebar
                      // doesn't move until the next page reload.
                      setFollowingCount((c) =>
                        Math.max(0, c + (nowFollowing ? 1 : -1)),
                      );
                      // Update the followingList too so the user
                      // disappears from suggestions on follow and
                      // reappears on unfollow.
                      setFollowingList((list) =>
                        nowFollowing
                          ? [
                              ...list,
                              {
                                following_tid: String(u.tid),
                                username: u.username ?? null,
                              },
                            ]
                          : list.filter(
                              (f) => f.following_tid !== String(u.tid),
                            ),
                      );
                    }}
                  />
                </div>
                {u.bio && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-gray-600">
                    {u.bio}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Following list */}
      {followingList.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900">Following</p>
          <div className="mt-2 space-y-2">
            {followingList.slice(0, 10).map((f) => (
              <div
                key={f.following_tid}
                className="flex items-center gap-2 text-sm"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-700">
                  {f.username
                    ? f.username[0].toUpperCase()
                    : f.following_tid}
                </div>
                <span className="text-gray-700">
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

function KarmaRow({
  label,
  count,
  weight,
}: {
  label: string;
  count: number;
  weight: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="text-gray-500">
        {count} × {weight} = <span className="font-mono text-gray-700">{count * weight}</span>
      </span>
    </div>
  );
}
