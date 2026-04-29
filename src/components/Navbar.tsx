"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { fetchUnreadCount } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { onFeedUpdate, subscribeTid } from "@/lib/ws";

const WalletButton = dynamic(
  async () => {
    const { WalletMultiButton } = await import(
      "@solana/wallet-adapter-react-ui"
    );
    return { default: WalletMultiButton };
  },
  {
    ssr: false,
    loading: () => (
      <button className="h-10 w-32 rounded-lg bg-blue-500 text-sm text-white">
        Loading...
      </button>
    ),
  }
);

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white/80 px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold text-white">
            T
          </div>
          <span className="text-xl font-bold text-gray-900">Tribe</span>
        </Link>

        <div className="hidden items-center gap-4 sm:flex">
          <Link
            href="/"
            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            Home
          </Link>
          <Link
            href="/explore"
            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            Explore
          </Link>
          <Link
            href="/channels"
            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            Channels
          </Link>
          <Link
            href="/polls"
            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            Polls
          </Link>
          <Link
            href="/events"
            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            Events
          </Link>
          <Link
            href="/tasks"
            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            Tasks
          </Link>
          <Link
            href="/crowdfunds"
            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            Crowdfunds
          </Link>
          <Link
            href="/messages"
            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            Messages
          </Link>
          <Link
            href="/bookmarks"
            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            Bookmarks
          </Link>
          <NotificationBadge />
          <Link
            href="/settings"
            className="text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            Settings
          </Link>
        </div>
      </div>

      <div className="hidden items-center gap-4 md:flex">
        <SearchBar />
      </div>

      <WalletButton
        style={{
          backgroundColor: "#3b82f6",
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          height: "2.5rem",
        }}
      />
    </nav>
  );
}

function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const tid = localStorage.getItem(STORAGE_KEYS.tid);
    if (!tid) return;

    // Initial fetch
    fetchUnreadCount(tid).then(setCount).catch(() => {});

    // Subscribe to real-time notifications via WebSocket
    subscribeTid(tid);
    const unsub = onFeedUpdate((event) => {
      if (event === "notification") {
        setCount((c) => c + 1);
      }
    });

    // Fallback poll every 60s (in case WS disconnects)
    const interval = setInterval(() => {
      fetchUnreadCount(tid).then(setCount).catch(() => {});
    }, 60000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="relative text-sm text-gray-600 transition-colors hover:text-gray-900"
    >
      Notifications
      {count > 0 && (
        <span className="absolute -right-3 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tweets..."
        className="w-48 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm text-gray-900 placeholder-gray-500 outline-none focus:border-blue-500 focus:w-64 focus:bg-white transition-all"
      />
    </form>
  );
}
