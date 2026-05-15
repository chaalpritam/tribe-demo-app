"use client";

import { useEffect, useState } from "react";
import { fetchStories, resolveMediaUrl, Story } from "@/lib/api";

/// Horizontal stories tray for the home feed. Renders one ring per
/// author with their newest active story; click opens the StoryViewer
/// for that author's stories oldest-first. Stories failure soft-degrades
/// to an empty bar — the feed itself is the load-bearing read.
interface StoriesBarProps {
  myTid?: number;
  onStoryClick: (authorTid: string, stories: Story[]) => void;
  onYourStoryClick: () => void;
  refreshKey?: number;
}

interface AuthorBucket {
  authorTid: string;
  username: string | null;
  pfpUrl: string | null;
  stories: Story[];
}

export default function StoriesBar({
  myTid,
  onStoryClick,
  onYourStoryClick,
  refreshKey,
}: StoriesBarProps) {
  const [buckets, setBuckets] = useState<AuthorBucket[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStories(100)
      .then((res) => {
        if (cancelled) return;
        // /v1/stories already returns rows grouped by author + newest
        // first within each. Re-bucket on the client so we have one
        // ring per author with all their stories handy.
        const map = new Map<string, AuthorBucket>();
        for (const s of res.stories) {
          const existing = map.get(s.author_tid);
          if (existing) {
            existing.stories.push(s);
          } else {
            map.set(s.author_tid, {
              authorTid: s.author_tid,
              username: s.username ?? null,
              pfpUrl: s.pfp_url ?? null,
              stories: [s],
            });
          }
        }
        // Hub returns newest first per author; viewer expects
        // chronological order so reverse here.
        for (const bucket of map.values()) {
          bucket.stories.reverse();
        }
        setBuckets(Array.from(map.values()));
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (error && buckets.length === 0) {
    // Quiet degradation — don't block the feed with an error banner.
    return null;
  }

  return (
    <div className="border-b border-gray-100">
      <div className="flex gap-3 overflow-x-auto px-4 py-3">
        <StoryItem
          label="Your story"
          isOwn
          imageUrl={null}
          onClick={onYourStoryClick}
        />
        {buckets
          .filter((b) => b.authorTid !== String(myTid ?? ""))
          .map((b) => (
            <StoryItem
              key={b.authorTid}
              label={b.username ?? `tid${b.authorTid}`}
              imageUrl={resolveMediaUrl(b.pfpUrl)}
              onClick={() => onStoryClick(b.authorTid, b.stories)}
            />
          ))}
      </div>
    </div>
  );
}

function StoryItem({
  label,
  imageUrl,
  isOwn,
  onClick,
}: {
  label: string;
  imageUrl: string | null;
  isOwn?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-1.5"
    >
      <div className="relative">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full p-0.5 ${
            isOwn
              ? "bg-gray-200"
              : "bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600"
          }`}
        >
          <div className="h-full w-full overflow-hidden rounded-full bg-white p-0.5">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={label}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                {label.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        {isOwn && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-white">
            <span className="text-xs font-bold leading-none text-white">+</span>
          </div>
        )}
      </div>
      <span className="max-w-[72px] truncate text-xs text-gray-700">{label}</span>
    </button>
  );
}
