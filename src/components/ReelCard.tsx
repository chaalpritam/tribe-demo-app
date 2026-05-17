"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { resolveMediaUrl } from "@/lib/api";
import LikeButton from "./LikeButton";

/// Single reel render. Uses the native <video> element with autoplay
/// + loop + muted (browser autoplay policies require muted to start);
/// IntersectionObserver pauses videos outside the viewport so a long
/// scroll doesn't keep N audio streams playing in the background.
///
/// Phase 4: hook the like/comment buttons up to the existing REACTION
/// envelopes (a reel is a TWEET_ADD row, so /v1/reactions works as-is —
/// just needs the buttons component pointed at the reel's hash).
interface ReelCardProps {
  hash: string;
  tid: number;
  videoUrl: string;
  caption: string;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  audioTitle: string | null;
  replyCount: number;
  /** Phase 6: server-side reaction aggregate from /v1/reels. */
  reactionCount?: number;
  myTid?: number;
}

export default function ReelCard({
  hash,
  tid,
  videoUrl,
  caption,
  username,
  displayName,
  pfpUrl,
  audioTitle,
  replyCount,
  reactionCount,
  myTid,
}: ReelCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Pause when out of view, play when in view. ~50% threshold so a
  // half-scrolled card doesn't keep playing.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio > 0.5) {
            el.play().catch(() => {
              /* autoplay can fail before user interaction; safe to ignore */
            });
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.5, 1] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pfp = resolveMediaUrl(pfpUrl);

  return (
    <div className="relative flex h-[100vh] snap-start items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={videoUrl}
        loop
        muted
        playsInline
        className="max-h-full max-w-full"
      />

      {/* Bottom-left meta */}
      <div className="absolute bottom-24 left-4 right-20 text-white">
        <div className="flex items-center gap-2">
          {pfp ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pfp}
              alt=""
              className="h-8 w-8 rounded-full border border-white object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white bg-gray-700 text-xs font-medium">
              {(displayName ?? username ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <Link
            href={`/profile?tid=${tid}`}
            className="text-sm font-semibold hover:underline"
          >
            {username ?? `tid${tid}`}
          </Link>
          {myTid !== tid && (
            <button className="ml-1 rounded-md border border-white px-2 py-0.5 text-xs font-semibold">
              Follow
            </button>
          )}
        </div>
        {caption && (
          <p className="mt-2 line-clamp-2 text-sm">{caption}</p>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span aria-hidden>♪</span>
          <span className="truncate">{audioTitle ?? "Original audio"}</span>
        </div>
      </div>

      {/* Right-side action rail */}
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-5 text-white">
        {/* LikeButton handles REACTION_ADD/REACTION_REMOVE against
            the reel's hash. Reels are TWEET_ADD rows in the same
            messages table as tweets — the existing /v1/reactions
            endpoint accepts the hash unchanged. variant="reels"
            switches to the big white-on-dark icon with count below. */}
        <LikeButton
          tweetHash={hash}
          tid={tid}
          variant="reels"
          initialCount={reactionCount}
        />

        <Link
          href={`/tweet?hash=${encodeURIComponent(hash)}`}
          aria-label="Comments"
          className="flex flex-col items-center"
        >
          <span className="text-3xl"><BubbleIcon /></span>
          {replyCount > 0 && (
            <span className="mt-0.5 text-xs font-semibold">{replyCount}</span>
          )}
        </Link>

        <RailButton
          icon={<ShareIcon />}
          onClick={() => {
            /* Copy a deep link the user can paste anywhere. The hash
               doubles as the share id — same convention tweets use. */
            navigator.clipboard?.writeText(
              `${window.location.origin}/tweet?hash=${encodeURIComponent(hash)}`
            );
          }}
          ariaLabel="Share"
        />
      </div>
    </div>
  );
}

function RailButton({
  icon,
  label,
  onClick,
  ariaLabel,
}: {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} className="flex flex-col items-center">
      <span className="text-3xl">{icon}</span>
      {label && <span className="mt-0.5 text-xs font-semibold">{label}</span>}
    </button>
  );
}

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 8.25c0-2.485-2.014-4.5-4.5-4.5-1.71 0-3.196.96-3.96 2.36-.765-1.4-2.25-2.36-3.96-2.36C6.014 3.75 4 5.765 4 8.25c0 6.108 8.5 11.25 8.5 11.25S21 14.358 21 8.25z"
    />
  </svg>
);

const BubbleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 1 1 3.4 6.55L4 19l.95-3.6A7.97 7.97 0 0 1 4 12z" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);
