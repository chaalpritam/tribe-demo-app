"use client";

import { useEffect, useState } from "react";
import { fetchStoryViewers, resolveMediaUrl, StoryViewer } from "@/lib/api";

/// Author-only "Seen by" modal for a single story. The hub 403s a
/// non-author request when viewer_tid is set; the StoryViewer also
/// hides the entry point so non-authors never see this in the first
/// place — but we surface the 403 message as a fallback.
interface StoryViewersModalProps {
  storyHash: string;
  myTid: number;
  onClose: () => void;
}

export default function StoryViewersModal({
  storyHash,
  myTid,
  onClose,
}: StoryViewersModalProps) {
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStoryViewers(storyHash, myTid)
      .then((res) => {
        if (!cancelled) setViewers(res.viewers ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storyHash, myTid]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Seen by</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
          ) : error ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-gray-900">
                Couldn&apos;t load viewers
              </p>
              <p className="mt-1 text-xs text-gray-500">{error}</p>
            </div>
          ) : viewers.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-gray-900">No one yet</p>
              <p className="mt-1 text-xs text-gray-500">
                Viewers show up here as they tap through your story.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {viewers.map((v) => (
                <li key={v.viewer_tid} className="flex items-center gap-3 px-1 py-2">
                  {resolveMediaUrl(v.pfp_url ?? null) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveMediaUrl(v.pfp_url ?? null) || ""}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-500">
                      {(v.username ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {v.username ?? `tid${v.viewer_tid}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {relativeTime(v.viewed_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
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
