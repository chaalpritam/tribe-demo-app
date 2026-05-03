"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { signAndRetweet } from "@/lib/messages";
import { fetchUserReactions } from "@/lib/api";

interface RetweetButtonProps {
  tweetHash: string;
  /** When provided, skips the server lookup on mount. */
  initialRetweeted?: boolean;
}

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

export default function RetweetButton({
  tweetHash,
  initialRetweeted,
}: RetweetButtonProps) {
  const [retweeted, setRetweeted] = useState(initialRetweeted ?? false);
  const [loading, setLoading] = useState(false);

  // Hydrate from the hub so the icon reflects persisted state on
  // reload. Without this, every reload starts grey and the user
  // can re-retweet the same tweet repeatedly.
  useEffect(() => {
    if (initialRetweeted !== undefined) return;
    const myTid = localStorage.getItem(STORAGE_KEYS.tid);
    if (!myTid) return;
    let cancelled = false;
    fetchUserReactions(myTid, 2)
      .then((reactions) => {
        if (cancelled) return;
        setRetweeted(reactions.some((r) => r.target_hash === tweetHash));
      })
      .catch(() => {
        // Non-fatal — leave default state.
      });
    return () => {
      cancelled = true;
    };
  }, [tweetHash, initialRetweeted]);

  const handleToggle = useCallback(async () => {
    if (loading) return;
    const tidStr = localStorage.getItem(STORAGE_KEYS.tid);
    const appKey = loadAppKey();
    if (!tidStr || !appKey) return;

    const tid = parseInt(tidStr, 10);
    const wantRetweeted = !retweeted;
    // Optimistic flip; revert on failure.
    setRetweeted(wantRetweeted);
    setLoading(true);
    try {
      await signAndRetweet({
        tid,
        targetHash: tweetHash,
        add: wantRetweeted,
        signingKeySecret: appKey,
      });
    } catch (err) {
      console.error("Retweet toggle failed:", err);
      setRetweeted(!wantRetweeted);
    } finally {
      setLoading(false);
    }
  }, [retweeted, loading, tweetHash]);

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-1 text-sm transition-colors ${
        retweeted ? "text-emerald-600" : "text-gray-500 hover:text-emerald-600"
      }`}
      title={retweeted ? "Undo retweet" : "Retweet"}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
      </svg>
    </button>
  );
}
