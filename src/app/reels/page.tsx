"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchReels, resolveMediaUrl } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import ReelCard from "@/components/ReelCard";
import MediaComposer from "@/components/MediaComposer";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";

interface ReelRow {
  hash: string;
  tid: string | number;
  text?: string | null;
  embeds?: string[] | null;
  username?: string | null;
  display_name?: string | null;
  pfp_url?: string | null;
  audio_title?: string | null;
  reply_count?: number;
  reaction_count?: number;
}

/// Vertical-snap reels feed. snap-y + snap-mandatory on the scroll
/// container, snap-start on each ReelCard — so swiping/scrolling lands
/// one reel at a time, mobile-first. The IntersectionObserver inside
/// ReelCard takes care of play/pause based on visibility.
export default function ReelsPage() {
  const [reels, setReels] = useState<ReelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTid, setMyTid] = useState<number | null>(null);
  const [showComposer, setShowComposer] = useState(false);

  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchReels({ limit: 20 })
      .then((res) => setReels(Array.isArray(res?.reels) ? res.reels : []))
      .catch(() => setError("Failed to load reels"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEYS.tid);
    if (cached) setMyTid(parseInt(cached, 10));
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-black px-6 text-center text-white">
        <div>
          <p className="text-base font-semibold">Couldn&apos;t load reels</p>
          <p className="mt-2 text-sm text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-black px-6 text-center text-white">
        <EmptyState
          title="No reels yet"
          description="Share a video from the iOS app to start the feed."
        />
      </div>
    );
  }

  return (
    <div className="relative h-screen snap-y snap-mandatory overflow-y-scroll bg-black">
      {myTid !== null && (
        <button
          onClick={() => setShowComposer(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl font-bold text-black shadow-lg hover:bg-gray-100"
          aria-label="New reel"
        >
          +
        </button>
      )}

      {showComposer && myTid !== null && (
        <MediaComposer
          mode="reel"
          tid={myTid}
          onClose={() => setShowComposer(false)}
          onPublished={load}
        />
      )}

      {reels.map((reel, idx) => {
        const firstEmbed = (reel.embeds ?? []).find((e) => !!e);
        const videoUrl = resolveMediaUrl(firstEmbed ?? null);
        if (!videoUrl) return null;
        return (
          <ReelCard
            key={reel.hash ?? idx}
            hash={reel.hash}
            tid={Number(reel.tid)}
            videoUrl={videoUrl}
            caption={reel.text ?? ""}
            username={reel.username ?? null}
            displayName={reel.display_name ?? null}
            pfpUrl={reel.pfp_url ?? null}
            audioTitle={reel.audio_title ?? null}
            replyCount={reel.reply_count ?? 0}
            reactionCount={reel.reaction_count}
            myTid={myTid ?? undefined}
          />
        );
      })}
    </div>
  );
}
