"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { erFollow, erUnfollow, erGetLink } from "@/lib/er-client";

interface FollowButtonProps {
  myTid: number;
  targetTid: number;
  onToggle?: (following: boolean) => void;
}

export default function FollowButton({
  myTid,
  targetTid,
  onToggle,
}: FollowButtonProps) {
  const { publicKey, signMessage } = useWallet();
  // `following` covers both `pending_follow` (recorded in the ER,
  // not yet settled to L1) and `settled` (on-chain). The settler
  // batches every 10s, so the distinction is an implementation
  // detail the user shouldn't have to think about — both states
  // render as "Following".
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (myTid === targetTid) return;
    erGetLink(myTid, targetTid).then((data) => {
      setFollowing(data.exists);
      setChecked(true);
    }).catch(() => setChecked(true));
  }, [myTid, targetTid]);

  const handleToggle = useCallback(async () => {
    if (!publicKey || !signMessage || myTid === targetTid) return;
    setLoading(true);
    try {
      if (following) {
        await erUnfollow(myTid, targetTid, publicKey.toBase58(), signMessage);
        setFollowing(false);
        onToggle?.(false);
      } else {
        await erFollow(myTid, targetTid, publicKey.toBase58(), signMessage);
        setFollowing(true);
        onToggle?.(true);
      }
    } catch (err) {
      console.error("Follow/unfollow error:", err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage, myTid, targetTid, following, onToggle]);

  if (myTid === targetTid || !checked) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`group rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
        following
          ? "border border-gray-300 bg-white text-gray-900 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          : "bg-gray-900 text-white hover:bg-gray-800"
      }`}
    >
      {loading ? (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : following ? (
        <>
          Following
          <span className="hidden group-hover:inline"> · Unfollow</span>
        </>
      ) : (
        "Follow"
      )}
    </button>
  );
}
