"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import LikeButton from "./LikeButton";
import BookmarkButton from "./BookmarkButton";
import RetweetButton from "./RetweetButton";
import TipButton from "./TipButton";
import { STORAGE_KEYS } from "@/lib/constants";
import { signAndRemoveTweet } from "@/lib/messages";
import { resolveMediaUrl } from "@/lib/api";

interface TweetCardProps {
  text: string;
  tid: number;
  timestamp: number;
  hash?: string;
  username?: string;
  /** Latest USER_DATA_ADD `displayName` for the author. Wins over the
   *  `${username}.tribe` fallback so a user's published display name
   *  shows up immediately on every card. */
  displayName?: string;
  pfpUrl?: string;
  myTid?: number;
  replyCount?: number;
  channelId?: string;
  embeds?: string[];
  /** When set, render a "@user retweeted" header above the card body
   *  so the original tweet still attributes correctly to its author
   *  while making clear this row appeared because of a retweet. */
  retweetedByTid?: number;
  retweetedByUsername?: string;
  /**
   * Called after a successful TWEET_REMOVE so the parent can drop the
   * tweet from its local list. The hub-side filter hides it on
   * subsequent reads, but optimistically clearing here keeps the UI
   * snappy.
   */
  onDeleted?: (hash: string) => void;
}

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

export default function TweetCard({
  text,
  tid,
  timestamp,
  hash,
  username,
  displayName: displayNameProp,
  pfpUrl,
  myTid,
  replyCount,
  channelId,
  embeds,
  retweetedByTid,
  retweetedByUsername,
  onDeleted,
}: TweetCardProps) {
  const date = new Date(timestamp * 1000);
  const timeAgo = getTimeAgo(date);
  const nameLabel = username ? `${username}.tribe` : `TID #${tid}`;
  const initial = (username || displayNameProp?.trim() || String(tid))[0]
    .toUpperCase();
  const isOwn = myTid !== undefined && myTid === tid;
  const [hidden, setHidden] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!hash || !isOwn || deleting) return;
    if (!window.confirm("Delete this tweet? This can't be undone.")) return;
    const appKey = loadAppKey();
    if (!appKey) return;
    setDeleting(true);
    setHidden(true);
    try {
      await signAndRemoveTweet({
        tid,
        targetHash: hash,
        signingKeySecret: appKey,
      });
      onDeleted?.(hash);
    } catch (err) {
      console.error("Tweet delete failed:", err);
      setHidden(false);
    } finally {
      setDeleting(false);
    }
  }, [hash, isOwn, deleting, tid, onDeleted]);

  if (hidden) return null;

  const resolvedPfp = pfpUrl ? resolveMediaUrl(pfpUrl) : null;

  const retweeterLabel = retweetedByUsername
    ? `${retweetedByUsername}.tribe`
    : retweetedByTid !== undefined
      ? `TID #${retweetedByTid}`
      : null;

  return (
    <div className="border-b border-gray-200 px-4 py-4 transition-colors hover:bg-gray-50">
      {retweeterLabel && (
        <div className="mb-2 flex items-center gap-1.5 pl-12 text-xs font-medium text-gray-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
          </svg>
          {retweetedByTid !== undefined ? (
            <Link
              href={`/profile?tid=${retweetedByTid}`}
              className="hover:underline"
            >
              {retweeterLabel} retweeted
            </Link>
          ) : (
            <span>{retweeterLabel} retweeted</span>
          )}
        </div>
      )}
      <div className="flex items-start gap-3">
        <Link
          href={`/profile?tid=${tid}`}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-900 text-sm font-semibold text-white shadow-inner ring-2 ring-white transition-transform hover:scale-105"
        >
          {resolvedPfp && !imgError ? (
            <img
              src={resolvedPfp}
              alt={nameLabel}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="bg-gradient-to-br from-gray-700 to-gray-900 flex h-full w-full items-center justify-center">
              {initial}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/profile?tid=${tid}`}
              className="font-semibold text-gray-900 hover:underline"
            >
              {nameLabel}
            </Link>
            <span className="text-xs text-gray-500 font-mono">#{tid}</span>
            {channelId && channelId !== "general" && (
              <>
                <span className="text-gray-400">·</span>
                <Link
                  href={`/channels/${encodeURIComponent(channelId)}`}
                  className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 transition-colors hover:bg-gray-200 hover:text-gray-900"
                >
                  {channelId}
                </Link>
              </>
            )}
            {displayNameProp?.trim() && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-sm text-gray-500">{displayNameProp}</span>
              </>
            )}
            <span className="text-gray-400">·</span>
            <span
              className="text-xs text-gray-500"
              title={date.toLocaleString()}
            >
              {timeAgo}
            </span>
            {isOwn && hash && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                title="Delete tweet"
                className="ml-auto text-sm text-gray-500 hover:text-red-500 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-gray-800">{text}</p>

          {/* Embedded images — accept both new media:<hash> refs and
              legacy absolute URLs. resolveMediaUrl always returns a
              URL pointed at the *current* hub, so image rendering
              survives hub IP changes. */}
          {(() => {
            const imageUrls = (embeds ?? [])
              .map((e) => resolveMediaUrl(e))
              .filter((u): u is string => !!u && u.includes("/v1/media/"));
            if (imageUrls.length === 0) return null;
            return (
              <div className={`mt-2 grid gap-1 ${imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {imageUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Attached image ${i + 1}`}
                    className="w-full rounded-lg object-cover"
                    style={{ maxHeight: imageUrls.length === 1 ? "400px" : "200px" }}
                    loading="lazy"
                  />
                ))}
              </div>
            );
          })()}

          {hash && (
            <div className="mt-2 flex items-center gap-5">
              {/* Reply button */}
              <Link
                href={`/tweet?hash=${encodeURIComponent(hash)}`}
                className="flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-blue-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
                {replyCount !== undefined && replyCount > 0 && (
                  <span>{replyCount}</span>
                )}
              </Link>

              {/* Retweet button */}
              <RetweetButton tweetHash={hash} />

              {/* Like button */}
              <LikeButton tweetHash={hash} tid={myTid ?? tid} />

              {/* Bookmark button */}
              <BookmarkButton tweetHash={hash} />

              {/* Tip button (on-chain SOL transfer + TIP_ADD envelope) */}
              {myTid !== undefined && (
                <TipButton
                  recipientTid={tid}
                  senderTid={myTid}
                  tweetHash={hash}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
