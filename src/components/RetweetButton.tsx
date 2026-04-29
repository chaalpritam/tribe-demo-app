"use client";

import { useState, useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { hubFetch } from "@/lib/failover";

interface RetweetButtonProps {
  tweetHash: string;
}

export default function RetweetButton({ tweetHash }: RetweetButtonProps) {
  const [retweeted, setRetweeted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async () => {
    const tid = localStorage.getItem(STORAGE_KEYS.tid);
    if (!tid || loading) return;
    setLoading(true);
    try {
      if (retweeted) {
        await hubFetch("/v1/retweet", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tid, tweetHash }),
        });
        setRetweeted(false);
      } else {
        await hubFetch("/v1/retweet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tid, tweetHash }),
        });
        setRetweeted(true);
      }
    } catch {
      // Revert optimistic state on failure
      setRetweeted((prev) => !prev);
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
