"use client";

interface TweetCardProps {
  text: string;
  tid: number;
  timestamp: number;
  hash?: string;
}

export default function TweetCard({ text, tid, timestamp, hash }: TweetCardProps) {
  const date = new Date(timestamp * 1000);
  const timeAgo = getTimeAgo(date);

  return (
    <div className="border-b border-gray-800 px-4 py-4 transition-colors hover:bg-gray-900/50">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600/20 text-sm font-semibold text-purple-400">
          {tid}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">TID #{tid}</span>
            <span className="text-sm text-gray-500">&middot;</span>
            <span className="text-sm text-gray-500" title={date.toLocaleString()}>
              {timeAgo}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-gray-200">{text}</p>
          {hash && (
            <p className="mt-2 truncate text-xs text-gray-600" title={hash}>
              {hash.slice(0, 16)}...
            </p>
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
