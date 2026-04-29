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
  const [following, setFollowing] = useState(false);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  // Check current follow status on mount
  useEffect(() => {
    if (myTid === targetTid) return;
    erGetLink(myTid, targetTid).then((data) => {
      setFollowing(data.exists);
      setPending(data.status === "pending_follow");
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
        setPending(false);
        onToggle?.(false);
      } else {
        await erFollow(myTid, targetTid, publicKey.toBase58(), signMessage);
        setFollowing(true);
        setPending(true);
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
      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
        following
          ? "border border-gray-300 text-gray-700 hover:border-red-300 hover:text-red-600"
          : "bg-white text-black hover:bg-gray-200"
      }`}
    >
      {loading
        ? "..."
        : following
        ? pending
          ? "Pending"
          : "Following"
        : "Follow"}
    </button>
  );
}
