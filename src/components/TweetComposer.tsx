"use client";

import { useState, useCallback } from "react";
import { signAndPublishTweet } from "@/lib/messages";
import { STORAGE_KEYS } from "@/lib/constants";

const MAX_CHARS = 320;

interface TweetComposerProps {
  tid: number;
  parentHash?: string;
  placeholder?: string;
  compact?: boolean;
  onTweetPublished?: () => void;
}

export default function TweetComposer({
  tid,
  parentHash,
  placeholder,
  compact = false,
  onTweetPublished,
}: TweetComposerProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charsLeft = MAX_CHARS - text.length;
  const isOverLimit = charsLeft < 0;

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || isOverLimit || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const secretKeyB64 = localStorage.getItem(STORAGE_KEYS.appKeySecret);
      if (!secretKeyB64) {
        setError("No app key found. Please register an app key first.");
        return;
      }

      const secretKey = Uint8Array.from(atob(secretKeyB64), (c) =>
        c.charCodeAt(0)
      );

      await signAndPublishTweet(tid, text.trim(), secretKey, undefined, parentHash);
      setText("");
      onTweetPublished?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish tweet");
    } finally {
      setSubmitting(false);
    }
  }, [text, isOverLimit, submitting, tid, parentHash, onTweetPublished]);

  return (
    <div className={compact ? "p-3" : "border-b border-gray-800 p-4"}>
      <textarea
        className="w-full resize-none rounded-lg bg-gray-900 p-3 text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-purple-600"
        rows={compact ? 2 : 3}
        placeholder={placeholder ?? (parentHash ? "Post your reply..." : "What's happening?")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_CHARS + 50}
      />
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`text-sm ${
            isOverLimit
              ? "text-red-500"
              : charsLeft < 20
              ? "text-yellow-500"
              : "text-gray-500"
          }`}
        >
          {charsLeft}
        </span>
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isOverLimit || submitting}
          className="rounded-full bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Posting..." : parentHash ? "Reply" : "Tweet"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
