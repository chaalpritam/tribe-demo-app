"use client";

import { useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { follow, unfollow, initSocialProfile, hasSocialProfile } from "@/lib/tribe";

interface FollowButtonProps {
  myTid: number;
  targetTid: number;
  isFollowing?: boolean;
  onToggle?: (following: boolean) => void;
}

export default function FollowButton({
  myTid,
  targetTid,
  isFollowing: initialFollowing = false,
  onToggle,
}: FollowButtonProps) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    if (!wallet || myTid === targetTid) return;
    setLoading(true);
    try {
      const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
      });

      if (following) {
        await unfollow(provider, myTid, targetTid);
        setFollowing(false);
        onToggle?.(false);
      } else {
        // Ensure both profiles exist before following
        if (!(await hasSocialProfile(connection, myTid))) {
          await initSocialProfile(provider, myTid);
        }
        if (!(await hasSocialProfile(connection, targetTid))) {
          // Can't init someone else's profile — skip if not initialized
        }
        await follow(provider, myTid, targetTid);
        setFollowing(true);
        onToggle?.(true);
      }
    } catch (err) {
      console.error("Follow/unfollow error:", err);
    } finally {
      setLoading(false);
    }
  }, [wallet, connection, myTid, targetTid, following, onToggle]);

  if (myTid === targetTid) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
        following
          ? "border border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-400"
          : "bg-white text-black hover:bg-gray-200"
      }`}
    >
      {loading ? "..." : following ? "Following" : "Follow"}
    </button>
  );
}
