"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveMediaUrl, Story } from "@/lib/api";
import { signAndViewStory } from "@/lib/messages";
import { STORAGE_KEYS } from "@/lib/constants";

/// Full-screen story viewer modal. Single-author for Phase 3 (matches
/// the iOS client); Phase 4 adds horizontal swipe between authors.
///
/// - Progress bars at the top showing position within the author's stories
/// - Click left/right halves of the image to navigate
/// - Arrow keys: left/right step, Escape closes
/// - On each story display, fires STORY_VIEW envelope. Idempotent
///   on the hub so re-scrubbing doesn't spam.
interface StoryViewerProps {
  stories: Story[];
  myTid?: number;
  onClose: () => void;
}

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

export default function StoryViewer({ stories, myTid, onClose }: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewedHashes] = useState(() => new Set<string>());

  const current = stories[currentIndex];

  const goForward = useCallback(() => {
    setCurrentIndex((i) => {
      if (i + 1 < stories.length) return i + 1;
      onClose();
      return i;
    });
  }, [onClose, stories.length]);

  const goBack = useCallback(() => {
    setCurrentIndex((i) => {
      if (i > 0) return i - 1;
      onClose();
      return i;
    });
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goForward();
      else if (e.key === "ArrowLeft") goBack();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goForward, goBack, onClose]);

  // Fire STORY_VIEW on first display of each story in this session.
  // Re-scrubs are a no-op locally (the Set dedupes) AND on the hub
  // (idempotent upsert).
  useEffect(() => {
    if (!current || !myTid) return;
    if (viewedHashes.has(current.hash)) return;
    viewedHashes.add(current.hash);
    const key = loadAppKey();
    if (!key) return;
    signAndViewStory({
      tid: myTid,
      storyHash: current.hash,
      signingKeySecret: key,
    }).catch(() => {
      // Soft-fail — leaving the dedupe in place is fine; the user
      // doesn't see anything wrong, and the hub-side view count just
      // misses one.
    });
  }, [current, myTid, viewedHashes]);

  const mediaUrl = useMemo(
    () => (current ? resolveMediaUrl(`media:${current.media_hash}`) : null),
    [current]
  );

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Progress bars across the top */}
      <div className="absolute left-4 right-4 top-3 flex gap-1">
        {stories.map((_, idx) => (
          <div
            key={idx}
            className={`h-0.5 flex-1 rounded-full ${
              idx <= currentIndex ? "bg-white" : "bg-white/30"
            }`}
          />
        ))}
      </div>

      {/* Header: author + close */}
      <div className="absolute left-4 right-4 top-8 flex items-center gap-3 text-white">
        <span className="text-sm font-semibold">
          {current.username ?? `tid${current.author_tid}`}
        </span>
        <span className="text-xs opacity-70">
          {relativeTime(current.created_at)}
        </span>
        <button
          onClick={onClose}
          className="ml-auto p-1 text-white/80 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Image */}
      {mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt=""
          className="max-h-screen max-w-full object-contain"
        />
      )}

      {/* Caption */}
      {current.caption && (
        <div className="absolute bottom-12 left-0 right-0 flex justify-center px-6">
          <span className="rounded-full bg-black/50 px-4 py-2 text-sm text-white">
            {current.caption}
          </span>
        </div>
      )}

      {/* Tap zones — left = back, right = forward */}
      <button
        onClick={goBack}
        className="absolute bottom-0 left-0 top-12 w-1/2 cursor-default"
        aria-label="Previous story"
      />
      <button
        onClick={goForward}
        className="absolute bottom-0 right-0 top-12 w-1/2 cursor-default"
        aria-label="Next story"
      />
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
