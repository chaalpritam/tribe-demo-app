"use client";

import { useState, useCallback } from "react";
import { INDEXER_URL, STORAGE_KEYS } from "@/lib/constants";

interface BookmarkButtonProps {
  tweetHash: string;
}

export default function BookmarkButton({ tweetHash }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    const tid = localStorage.getItem(STORAGE_KEYS.tid);
    if (!tid || loading) return;
    setLoading(true);
    try {
      if (bookmarked) {
        await fetch(`${INDEXER_URL}/v1/bookmarks/${tid}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tweetHash }),
        });
        setBookmarked(false);
      } else {
        await fetch(`${INDEXER_URL}/v1/bookmarks/${tid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tweetHash }),
        });
        setBookmarked(true);
      }
    } catch {
      // ignore
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
