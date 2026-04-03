"use client";

import Link from "next/link";
import LikeButton from "./LikeButton";
import BookmarkButton from "./BookmarkButton";

interface TweetCardProps {
  text: string;
  tid: number;
  timestamp: number;
  hash?: string;
  username?: string;
  myTid?: number;
  replyCount?: number;
  embeds?: string[];
}

export default function TweetCard({
  text,
  tid,
  timestamp,
  hash,
  username,
  myTid,
  replyCount,
  embeds,
}: TweetCardProps) {
  const date = new Date(timestamp * 1000);
  const timeAgo = getTimeAgo(date);
  const displayName = username ? `${username}.tribe` : `TID #${tid}`;
  const initial = username ? username[0].toUpperCase() : String(tid);

  return (
    <div className="border-b border-gray-800 px-4 py-4 transition-colors hover:bg-gray-900/50">
      <div className="flex items-start gap-3">
        <Link
          href={`/profile?tid=${tid}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600/20 text-sm font-semibold text-purple-400 transition-colors hover:bg-purple-600/30"
        >
          {initial}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/profile?tid=${tid}`}
              className="font-semibold text-white hover:underline"
            >
              {displayName}
            </Link>
            {username && (
              <span className="text-sm text-gray-500">#{tid}</span>
            )}
            <span className="text-sm text-gray-500">&middot;</span>
            <span
              className="text-sm text-gray-500"
              title={date.toLocaleString()}
            >
              {timeAgo}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-gray-200">{text}</p>

          {/* Embedded images */}
          {embeds && embeds.length > 0 && (
            <div className={`mt-2 grid gap-1 ${embeds.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {embeds.filter(e => e.includes("/media/")).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-full rounded-lg object-cover"
                  style={{ maxHeight: embeds.length === 1 ? "400px" : "200px" }}
                  loading="lazy"
                />
              ))}
            </div>
          )}

          {hash && (
            <div className="mt-2 flex items-center gap-5">
              {/* Reply button */}
              <Link
                href={`/tweet?hash=${encodeURIComponent(hash)}`}
                className="flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-purple-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
                </svg>
                {replyCount !== undefined && replyCount > 0 && (
                  <span>{replyCount}</span>
                )}
              </Link>

              {/* Like button */}
              <LikeButton tweetHash={hash} tid={myTid ?? tid} />

              {/* Bookmark button */}
              <BookmarkButton tweetHash={hash} />
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
