"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { fetchBookmarks } from "@/lib/api";
import { signAndBookmark } from "@/lib/messages";

interface BookmarkButtonProps {
  tweetHash: string;
  /** When provided, skips the server lookup on mount. */
  initialBookmarked?: boolean;
}

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

export default function BookmarkButton({
  tweetHash,
  initialBookmarked,
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked ?? false);
  const [loading, setLoading] = useState(false);

  // Fetch the user's bookmarks once on mount so the button reflects
  // existing state across reloads. Skipped when initialBookmarked is
  // passed by a parent that already knows.
  useEffect(() => {
    if (initialBookmarked !== undefined) return;
    const tid = localStorage.getItem(STORAGE_KEYS.tid);
    if (!tid) return;
    let cancelled = false;
    fetchBookmarks(tid)
      .then((rows) => {
        if (cancelled) return;
        if (Array.isArray(rows)) {
          setBookmarked(rows.some((b) => b.target_hash === tweetHash));
        } else if (
          rows &&
          typeof rows === "object" &&
          Array.isArray((rows as { bookmarks?: unknown }).bookmarks)
        ) {
          setBookmarked(
            (rows as { bookmarks: { target_hash: string }[] }).bookmarks.some(
              (b) => b.target_hash === tweetHash,
            ),
          );
        }
      })
      .catch(() => {
        // Non-fatal — leave default state
      });
    return () => {
      cancelled = true;
    };
  }, [tweetHash, initialBookmarked]);

  const handleToggle = useCallback(async () => {
    if (loading) return;
    const tidStr = localStorage.getItem(STORAGE_KEYS.tid);
    const appKey = loadAppKey();
    if (!tidStr || !appKey) return;

    const tid = parseInt(tidStr, 10);
    const wantAdd = !bookmarked;
    // Optimistic flip; revert on failure.
    setBookmarked(wantAdd);
    setLoading(true);
    try {
      await signAndBookmark({
        tid,
        targetHash: tweetHash,
        add: wantAdd,
        signingKeySecret: appKey,
      });
    } catch (err) {
      console.error("Bookmark toggle failed:", err);
      setBookmarked(!wantAdd);
    } finally {
      setLoading(false);
    }
  }, [bookmarked, loading, tweetHash]);

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`text-sm transition-colors ${
        bookmarked ? "text-yellow-500" : "text-gray-500 hover:text-yellow-400"
      }`}
      title={bookmarked ? "Remove bookmark" : "Bookmark"}
    >
      <svg className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
      </svg>
    </button>
  );
}
