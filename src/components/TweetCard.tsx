"use client";

import Link from "next/link";
import LikeButton from "./LikeButton";

interface TweetCardProps {
  text: string;
  tid: number;
  timestamp: number;
  hash?: string;
  username?: string;
  myTid?: number;
}

export default function TweetCard({
  text,
  tid,
  timestamp,
  hash,
  username,
  myTid,
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

          {hash && (
            <div className="mt-2 flex items-center gap-6">
              <LikeButton tweetHash={hash} tid={myTid ?? tid} />
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
