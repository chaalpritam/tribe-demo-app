"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { signAndLikeTweet } from "@/lib/messages";
import { fetchUserReactions } from "@/lib/api";

interface LikeButtonProps {
  tweetHash: string;
  tid: number;
  initialCount?: number;
  /** When provided, skips the server lookup on mount. */
  initialLiked?: boolean;
}

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

export default function LikeButton({
  tweetHash,
  tid,
  initialCount = 0,
  initialLiked,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked ?? false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  // Without this fallback, the heart resets to gray on every reload
  // even when the user has already liked the tweet — and clicking
  // again writes a duplicate REACTION_ADD into the messages table.
  // Same fallback BookmarkButton uses; skipped when the parent
  // already knows the liked state.
  useEffect(() => {
    if (initialLiked !== undefined) return;
    const myTid = localStorage.getItem(STORAGE_KEYS.tid);
    if (!myTid) return;
    let cancelled = false;
    fetchUserReactions(myTid, 1)
      .then((reactions) => {
        if (cancelled) return;
        setLiked(reactions.some((r) => r.target_hash === tweetHash));
      })
      .catch(() => {
        // Non-fatal — leave default state.
      });
    return () => {
      cancelled = true;
    };
  }, [tweetHash, initialLiked]);

  const handleToggle = useCallback(async () => {
    if (loading) return;
    const appKey = loadAppKey();
    if (!appKey) return;

    const wantLiked = !liked;
    // Optimistic flip; revert if the submit fails. The count change
    // is also optimistic — the hub doesn't currently return updated
    // counts in the submit response, so we update locally.
    setLiked(wantLiked);
    setCount((c) => Math.max(0, c + (wantLiked ? 1 : -1)));
    setLoading(true);

    try {
      await signAndLikeTweet({
        tid,
        targetHash: tweetHash,
        add: wantLiked,
        signingKeySecret: appKey,
      });
    } catch (err) {
      console.error("Like toggle failed:", err);
      setLiked(!wantLiked);
      setCount((c) => Math.max(0, c + (wantLiked ? -1 : 1)));
    } finally {
      setLoading(false);
    }
  }, [liked, loading, tid, tweetHash]);

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-1 text-sm transition-colors ${
        liked ? "text-pink-500" : "text-gray-500 hover:text-pink-400"
      }`}
      title={liked ? "Unlike" : "Like"}
    >
      <svg className="h-4 w-4" fill={liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
      </svg>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
