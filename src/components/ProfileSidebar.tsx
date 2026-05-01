"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  fetchUser,
  fetchFollowing,
  fetchKarma,
  resolveMediaUrl,
  type KarmaSummary,
} from "@/lib/api";
import { erFollow } from "@/lib/er-client";
import LogoutButton from "./LogoutButton";

const WalletButton = dynamic(
  async () => {
    const { WalletMultiButton } = await import(
      "@solana/wallet-adapter-react-ui"
    );
    return { default: WalletMultiButton };
  },
  {
    ssr: false,
    loading: () => <div className="h-10 w-full rounded-lg bg-gray-200" />,
  }
);

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
  const [karma, setKarma] = useState<KarmaSummary | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const user = await fetchUser(tid);
        setUsername(user?.username ?? null);
        const profile = (user?.profile ?? {}) as Record<string, string>;
        setDisplayName(profile.displayName ?? null);
        setBio(profile.bio ?? null);
        setAvatarUrl(profile.pfpUrl ?? null);
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
      {/* Wallet card — sits above profile details */}
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <WalletButton
          style={{
            backgroundColor: "#18181b",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            height: "2.5rem",
            width: "100%",
            justifyContent: "center",
          }}
        />
        <LogoutButton />
      </div>

      {/* Profile card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={resolveMediaUrl(avatarUrl) ?? ""} alt="User avatar" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-lg font-bold text-white">
              {username ? username[0].toUpperCase() : tid}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{nameDisplay}</p>
            <p className="text-sm text-gray-600" title={walletAddress}>
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

      {/* Follow someone */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">Follow a user</p>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={followInput}
            onChange={(e) => setFollowInput(e.target.value)}
            placeholder="Enter TID"
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-500 outline-none focus:border-gray-900"
          />
          <button
            onClick={handleFollow}
            disabled={followLoading || !followInput.trim()}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {followLoading ? "..." : "Follow"}
          </button>
        </div>
        {followError && (
          <p className="mt-1 text-xs text-red-600">{followError}</p>
        )}
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
