"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  searchTweets,
  searchUsers,
  searchChannels,
  searchPolls,
  searchEvents,
  searchTasks,
  searchCrowdfunds,
} from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import TweetCard from "@/components/TweetCard";

export default function SearchPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <SearchPage />
    </Suspense>
  );
}

interface Tweet {
  hash?: string;
  tid?: string | number;
  text?: string;
  timestamp?: string | number;
  username?: string | null;
  reply_count?: number;
}

interface UserRow {
  tid: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
}

interface ChannelRow {
  id: string;
  name: string | null;
  description: string | null;
  member_count: number | string;
}

interface PollRow {
  id: string;
  creator_tid: string;
  creator_username: string | null;
  question: string;
  total_votes: number | string;
}

interface EventRow {
  id: string;
  creator_tid: string;
  creator_username: string | null;
  title: string;
  starts_at: string;
  location_text: string | null;
  yes_count: number | string;
}

interface TaskRow {
  id: string;
  creator_tid: string;
  creator_username: string | null;
  title: string;
  reward_text: string | null;
  status: string;
}

interface CrowdfundRow {
  id: string;
  creator_tid: string;
  creator_username: string | null;
  title: string;
  goal_amount: string | number;
  pledged_amount: string | number;
  currency: string;
}

function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [crowdfunds, setCrowdfunds] = useState<CrowdfundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTid, setMyTid] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setTweets([]);
      setUsers([]);
      setChannels([]);
      setPolls([]);
      setEvents([]);
      setTasks([]);
      setCrowdfunds([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    Promise.allSettled([
      searchTweets(query),
      searchUsers(query),
      searchChannels(query),
      searchPolls(query),
      searchEvents(query),
      searchTasks(query),
      searchCrowdfunds(query),
    ])
      .then((results) => {
        if (cancelled) return;
        const pick = <T,>(idx: number, key: string): T[] => {
          const r = results[idx];
          if (r.status !== "fulfilled" || !r.value) return [];
          const v = (r.value as Record<string, unknown>)[key];
          return Array.isArray(v) ? (v as T[]) : [];
        };
        setTweets(pick<Tweet>(0, "tweets"));
        setUsers(pick<UserRow>(1, "users"));
        setChannels(pick<ChannelRow>(2, "channels"));
        setPolls(pick<PollRow>(3, "polls"));
        setEvents(pick<EventRow>(4, "events"));
        setTasks(pick<TaskRow>(5, "tasks"));
        setCrowdfunds(pick<CrowdfundRow>(6, "crowdfunds"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const totalCount =
    tweets.length +
    users.length +
    channels.length +
    polls.length +
    events.length +
    tasks.length +
    crowdfunds.length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Search: &ldquo;{query}&rdquo;
      </h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : totalCount === 0 ? (
        <p className="mt-8 text-center text-gray-500">
          No results found for &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="mt-4 space-y-6">
          {users.length > 0 && (
            <Section title={`People (${users.length})`}>
              {users.map((u) => (
                <Link
                  key={u.tid}
                  href={`/profile?tid=${u.tid}`}
                  className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {u.display_name ??
                      (u.username ? `${u.username}.tribe` : `TID #${u.tid}`)}
                  </p>
                  {u.username && u.display_name && (
                    <p className="text-xs text-gray-500">
                      {u.username}.tribe
                    </p>
                  )}
                  {u.bio && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                      {u.bio}
                    </p>
                  )}
                </Link>
              ))}
            </Section>
          )}

          {channels.length > 0 && (
            <Section title={`Channels (${channels.length})`}>
              {channels.map((c) => (
                <Link
                  key={c.id}
                  href={`/channels/${encodeURIComponent(c.id)}`}
                  className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    #{c.id}
                  </p>
                  {c.name && (
                    <p className="text-xs text-gray-500">{c.name}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {Number(c.member_count)} member
                    {Number(c.member_count) === 1 ? "" : "s"}
                  </p>
                </Link>
              ))}
            </Section>
          )}

          {polls.length > 0 && (
            <Section title={`Polls (${polls.length})`}>
              {polls.map((p) => (
                <Link
                  key={p.id}
                  href={`/polls`}
                  className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {p.question}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {Number(p.total_votes)} vote
                    {Number(p.total_votes) === 1 ? "" : "s"} · by{" "}
                    {p.creator_username
                      ? `${p.creator_username}.tribe`
                      : `TID #${p.creator_tid}`}
                  </p>
                </Link>
              ))}
            </Section>
          )}

          {events.length > 0 && (
            <Section title={`Events (${events.length})`}>
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/events`}
                  className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {e.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(e.starts_at).toLocaleString()}
                    {e.location_text ? ` · ${e.location_text}` : ""}
                  </p>
                  <p className="text-xs text-gray-500">
                    {Number(e.yes_count)} going · by{" "}
                    {e.creator_username
                      ? `${e.creator_username}.tribe`
                      : `TID #${e.creator_tid}`}
                  </p>
                </Link>
              ))}
            </Section>
          )}

          {tasks.length > 0 && (
            <Section title={`Tasks (${tasks.length})`}>
              {tasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/tasks`}
                  className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {t.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {t.status}
                    {t.reward_text ? ` · reward: ${t.reward_text}` : ""}
                  </p>
                  <p className="text-xs text-gray-500">
                    by{" "}
                    {t.creator_username
                      ? `${t.creator_username}.tribe`
                      : `TID #${t.creator_tid}`}
                  </p>
                </Link>
              ))}
            </Section>
          )}

          {crowdfunds.length > 0 && (
            <Section title={`Crowdfunds (${crowdfunds.length})`}>
              {crowdfunds.map((cf) => {
                const pledged = Number(cf.pledged_amount ?? 0);
                const goal = Number(cf.goal_amount ?? 0);
                const pct = goal > 0 ? Math.min(100, (pledged / goal) * 100) : 0;
                return (
                  <Link
                    key={cf.id}
                    href={`/crowdfunds`}
                    className="block rounded-lg border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50"
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {cf.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {pledged} / {goal} {cf.currency} ({pct.toFixed(0)}%) · by{" "}
                      {cf.creator_username
                        ? `${cf.creator_username}.tribe`
                        : `TID #${cf.creator_tid}`}
                    </p>
                  </Link>
                );
              })}
            </Section>
          )}

          {tweets.length > 0 && (
            <Section title={`Tweets (${tweets.length})`}>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                {tweets.map((tweet, i) => {
                  const ts =
                    typeof tweet.timestamp === "string"
                      ? Math.floor(new Date(tweet.timestamp).getTime() / 1000)
                      : (tweet.timestamp ?? 0);
                  return (
                    <TweetCard
                      key={tweet.hash ?? i}
                      text={tweet.text ?? ""}
                      tid={Number(tweet.tid ?? 0)}
                      timestamp={ts}
                      hash={tweet.hash}
                      username={tweet.username ?? undefined}
                      myTid={myTid ?? undefined}
                      replyCount={tweet.reply_count}
                    />
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
