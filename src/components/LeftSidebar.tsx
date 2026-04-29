"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
      <div className="h-10 w-full rounded-lg bg-blue-500/40" />
    ),
  }
);

interface NavItem {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactElement;
  badgeKey?: "notifications";
  match?: (path: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Home",
    match: (p) => p === "/",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.8}
        className="h-6 w-6"
      >
        <path d="M3 11.5L12 4l9 7.5V21h-6v-6H9v6H3v-9.5z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        className="h-6 w-6"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
  {
    href: "/explore",
    label: "Explore",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.8}
        className="h-6 w-6"
      >
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={1.8} />
        <path d="m15 9-2.5 5.5L7 17l2.5-5.5L15 9z" />
      </svg>
    ),
  },
  {
    href: "/notifications",
    label: "Notifications",
    badgeKey: "notifications",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.8}
        className="h-6 w-6"
      >
        <path
          d="M12 3a6 6 0 0 0-6 6v3.5L4 16h16l-2-3.5V9a6 6 0 0 0-6-6z"
          strokeLinejoin="round"
        />
        <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/messages",
    label: "Messages",
    match: (p) => p.startsWith("/messages"),
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.8}
        className="h-6 w-6"
      >
        <path
          d="M4 5h16v12H8l-4 4V5z"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/channels",
    label: "Channels",
    match: (p) => p.startsWith("/channels"),
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        className="h-6 w-6"
      >
        <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/polls",
    label: "Polls",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        className="h-6 w-6"
      >
        <rect x="4" y="10" width="3" height="10" rx="1" />
        <rect x="10.5" y="6" width="3" height="14" rx="1" />
        <rect x="17" y="13" width="3" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Events",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.8}
        className="h-6 w-6"
      >
        <rect x="4" y="6" width="16" height="14" rx="2" strokeLinejoin="round" />
        <path d="M4 10h16M9 4v4M15 4v4" strokeLinecap="round" stroke="white" strokeWidth={active ? 1.6 : 0} />
        <path d="M4 10h16M9 4v4M15 4v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        className="h-6 w-6"
      >
        <path d="M5 7l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 17l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 7h6M14 17h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/crowdfunds",
    label: "Crowdfunds",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.8}
        className="h-6 w-6"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" strokeLinecap="round" stroke={active ? "white" : "currentColor"} strokeWidth={1.8} fill="none" />
      </svg>
    ),
  },
  {
    href: "/bookmarks",
    label: "Bookmarks",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.8}
        className="h-6 w-6"
      >
        <path d="M6 4h12v17l-6-4-6 4V4z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        className="h-6 w-6"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 13a7.5 7.5 0 0 0 0-2l1.6-1.2-1.5-2.6-1.9.6a7.5 7.5 0 0 0-1.7-1l-.4-2H10.5l-.4 2a7.5 7.5 0 0 0-1.7 1l-1.9-.6L5 9.8 6.6 11a7.5 7.5 0 0 0 0 2L5 14.2l1.5 2.6 1.9-.6a7.5 7.5 0 0 0 1.7 1l.4 2h3l.4-2a7.5 7.5 0 0 0 1.7-1l1.9.6 1.5-2.6L19.4 13z" />
      </svg>
    ),
  },
];

function useNotificationCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const tid = localStorage.getItem(STORAGE_KEYS.tid);
    if (!tid) return;
    fetchUnreadCount(tid)
      .then(setCount)
      .catch(() => {});
    subscribeTid(tid);
    const unsub = onFeedUpdate((event) => {
      if (event === "notification") setCount((c) => c + 1);
    });
    const interval = setInterval(() => {
      fetchUnreadCount(tid)
        .then(setCount)
        .catch(() => {});
    }, 60000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);
  return count;
}

export default function LeftSidebar() {
  const pathname = usePathname() ?? "/";
  const notifCount = useNotificationCount();

  const isActive = (item: NavItem) =>
    item.match ? item.match(pathname) : pathname === item.href;

  return (
    <>
      {/* Desktop / tablet left rail */}
      <aside className="sticky top-0 hidden h-screen shrink-0 border-r border-gray-200 bg-white md:flex md:w-[72px] md:flex-col xl:w-64">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 pt-5 xl:px-6"
          aria-label="Tribe home"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-base font-bold text-white">
            T
          </div>
          <span className="hidden text-xl font-bold tracking-tight text-gray-900 xl:block">
            Tribe
          </span>
        </Link>

        <div className="px-3 pt-4 pb-3 xl:px-4">
          <div className="hidden xl:block">
            <WalletButton
              style={{
                backgroundColor: "#3b82f6",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                height: "2.5rem",
                width: "100%",
                justifyContent: "center",
              }}
            />
          </div>
          <Link
            href="/settings"
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white xl:hidden"
            title="Wallet / settings"
          >
            T
          </Link>
        </div>

        <nav className="flex-1 space-y-1 border-t border-gray-100 px-2 pt-3 pb-4 xl:px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const badge =
              item.badgeKey === "notifications" ? notifCount : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-4 rounded-lg px-3 py-2.5 text-[15px] transition-colors ${
                  active
                    ? "font-semibold text-gray-900"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                title={item.label}
              >
                <span className="relative flex h-6 w-6 items-center justify-center text-gray-900">
                  {item.icon(active)}
                  {badge > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-gray-200 bg-white py-2 md:hidden">
        {[
          NAV_ITEMS[0], // Home
          NAV_ITEMS[1], // Search
          NAV_ITEMS[3], // Notifications
          NAV_ITEMS[4], // Messages
          NAV_ITEMS[11], // Settings
        ].map((item) => {
          const active = isActive(item);
          const badge = item.badgeKey === "notifications" ? notifCount : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1 text-gray-700"
              aria-label={item.label}
            >
              <span className="relative">
                {item.icon(active)}
                {badge > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] ${
                  active ? "font-semibold text-gray-900" : "text-gray-500"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
