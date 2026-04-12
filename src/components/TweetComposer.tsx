"use client";

import { useState, useCallback, useRef } from "react";
import { signAndPublishTweet } from "@/lib/messages";
import { uploadMedia, getMediaUrl } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";

const MAX_CHARS = 320;

interface TweetComposerProps {
  tid: number;
  parentHash?: string;
  channelId?: string;
  placeholder?: string;
  compact?: boolean;
  onTweetPublished?: () => void;
}

export default function TweetComposer({
  tid,
  parentHash,
  channelId,
  placeholder,
  compact = false,
  onTweetPublished,
}: TweetComposerProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaHashes, setMediaHashes] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charsLeft = MAX_CHARS - text.length;
  const isOverLimit = charsLeft < 0;

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const result = await uploadMedia(file);
      setMediaHashes((prev) => [...prev, result.hash]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const removeMedia = useCallback((hash: string) => {
    setMediaHashes((prev) => prev.filter((h) => h !== hash));
  }, []);

  const handleSubmit = useCallback(async () => {
    if ((!text.trim() && mediaHashes.length === 0) || isOverLimit || submitting) return;
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

      // Embeds are media URLs
      const embeds = mediaHashes.map((h) => getMediaUrl(h));

      await signAndPublishTweet(
        tid,
        text.trim() || (mediaHashes.length > 0 ? "" : ""),
        secretKey,
        undefined,
        parentHash,
        channelId,
        embeds
      );
      setText("");
      setMediaHashes([]);
      onTweetPublished?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish tweet");
    } finally {
      setSubmitting(false);
    }
  }, [text, mediaHashes, isOverLimit, submitting, tid, parentHash, channelId, onTweetPublished]);

  return (
    <div className={compact ? "p-3" : "border-b border-gray-200 p-4"}>
      <textarea
        className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-900 placeholder-gray-500 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors"
        rows={compact ? 2 : 3}
        placeholder={placeholder ?? (parentHash ? "Post your reply..." : "What's happening?")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_CHARS + 50}
      />

      {/* Media previews */}
      {mediaHashes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {mediaHashes.map((hash) => (
            <div key={hash} className="group relative">
              <img
                src={getMediaUrl(hash)}
                alt=""
                className="h-20 w-20 rounded-lg object-cover"
              />
              <button
                onClick={() => removeMedia(hash)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Image upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || mediaHashes.length >= 4}
            className="text-gray-500 transition-colors hover:text-blue-500 disabled:opacity-50"
            title="Add image"
          >
            {uploading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
              </svg>
            )}
          </button>
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
        </div>
        <button
          onClick={handleSubmit}
          disabled={(!text.trim() && mediaHashes.length === 0) || isOverLimit || submitting}
          className="rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
        >
          {submitting ? "Posting..." : parentHash ? "Reply" : "Tweet"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
