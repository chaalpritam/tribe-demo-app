"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchPoll, fetchPolls, fetchUserPollVote, type PollRow } from "@/lib/api";
import { signAndCreatePoll, signAndVotePoll } from "@/lib/messages";
import { STORAGE_KEYS } from "@/lib/constants";

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

const POLL_ID_RE = /^[a-z0-9-]{1,64}$/;

export default function PollsPage() {
  const { connected } = useWallet();
  const [myTid, setMyTid] = useState<number | null>(null);
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPolls()
      .then(({ polls }) => setPolls(polls))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Connect your wallet to view polls</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Polls</h1>
          <p className="mt-1 text-sm text-gray-400">
            Ask the network a question
          </p>
        </div>
        {myTid !== null && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            + New
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      ) : polls.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">No polls yet.</p>
          <p className="mt-1 text-sm text-gray-600">
            Click <span className="text-purple-400">+ New</span> to start one.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {polls.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              myTid={myTid}
              onVoted={() => setRefreshKey((k) => k + 1)}
            />
          ))}
        </div>
      )}

      {showCreate && myTid !== null && (
        <CreatePollModal
          tid={myTid}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

interface PollCardProps {
  poll: PollRow;
  myTid: number | null;
  onVoted: () => void;
}

function PollCard({ poll, myTid, onVoted }: PollCardProps) {
  const [tally, setTally] = useState<Record<string, number>>({});
  const [myChoice, setMyChoice] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);

  // Pull the live tally + the viewer's existing vote on mount and
  // any time we re-render after a vote.
  useEffect(() => {
    let cancelled = false;
    fetchPoll(poll.id).then((p) => {
      if (cancelled) return;
      if (p?.tally) setTally(p.tally);
    });
    if (myTid !== null) {
      fetchUserPollVote(poll.id, String(myTid)).then((v) => {
        if (cancelled) return;
        if (v) setMyChoice(v.option_index);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [poll.id, myTid]);

  const totalVotes = useMemo(
    () => Object.values(tally).reduce((sum, n) => sum + n, 0),
    [tally],
  );

  const expired = poll.expires_at
    ? new Date(poll.expires_at).getTime() < Date.now()
    : false;

  const handleVote = useCallback(
    async (idx: number) => {
      if (myTid === null || voting || expired) return;
      const appKey = loadAppKey();
      if (!appKey) return;
      const previous = myChoice;
      setMyChoice(idx);
      setTally((t) => {
        const next = { ...t };
        if (previous !== null && previous !== idx) {
          next[previous] = Math.max(0, (next[previous] ?? 0) - 1);
        }
        if (previous !== idx) {
          next[idx] = (next[idx] ?? 0) + 1;
        }
        return next;
      });
      setVoting(true);
      try {
        await signAndVotePoll({
          tid: myTid,
          pollId: poll.id,
          optionIndex: idx,
          signingKeySecret: appKey,
        });
        onVoted();
      } catch (err) {
        console.error("Poll vote failed:", err);
        setMyChoice(previous);
      } finally {
        setVoting(false);
      }
    },
    [myTid, myChoice, voting, expired, poll.id, onVoted],
  );

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-white">{poll.question}</p>
        <span className="shrink-0 text-xs text-gray-500">
          TID #{poll.creator_tid}
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        {poll.options.map((label, i) => {
          const votes = tally[i] ?? 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isMine = myChoice === i;
          return (
            <button
              key={i}
              onClick={() => handleVote(i)}
              disabled={voting || expired || myTid === null}
              className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                isMine
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-gray-700 hover:bg-gray-800"
              } ${voting || expired ? "cursor-default" : ""}`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-purple-500/20"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between text-white">
                <span>
                  {label}
                  {isMine && (
                    <span className="ml-2 text-[10px] uppercase text-purple-300">
                      your vote
                    </span>
                  )}
                </span>
                <span className="text-xs text-gray-400">
                  {votes} · {pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        {expired && <> · closed</>}
        {!expired && poll.expires_at && (
          <> · closes {new Date(poll.expires_at).toLocaleString()}</>
        )}
      </p>
    </div>
  );
}

interface CreatePollModalProps {
  tid: number;
  onClose: () => void;
  onCreated: () => void;
}

function CreatePollModal({ tid, onClose, onCreated }: CreatePollModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [expiresAt, setExpiresAt] = useState(""); // datetime-local
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOption = (i: number, value: string) =>
    setOptions((opts) => opts.map((o, j) => (j === i ? value : o)));

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!question.trim()) {
      setError("Question is required");
      return;
    }
    const cleanedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanedOptions.length < 2) {
      setError("Need at least 2 non-empty options");
      return;
    }
    if (cleanedOptions.length > 10) {
      setError("Max 10 options");
      return;
    }
    const appKey = loadAppKey();
    if (!appKey) {
      setError("No app key — register your identity first");
      return;
    }

    // Generate a slug — hub's regex is /^[a-z0-9-]{1,64}$/.
    const slug = `p-${Math.random().toString(36).slice(2, 10)}-${Date.now()
      .toString(36)
      .slice(-4)}`;
    if (!POLL_ID_RE.test(slug)) {
      setError("Could not generate a valid poll id");
      return;
    }

    let expiresAtUnix: number | undefined;
    if (expiresAt) {
      const t = new Date(expiresAt).getTime();
      if (Number.isFinite(t)) expiresAtUnix = Math.floor(t / 1000);
    }

    setSubmitting(true);
    try {
      await signAndCreatePoll({
        tid,
        pollId: slug,
        question: question.trim(),
        options: cleanedOptions,
        expiresAtUnix,
        signingKeySecret: appKey,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create poll");
    } finally {
      setSubmitting(false);
    }
  }, [question, options, expiresAt, tid, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New poll</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400">Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should we name the bot?"
              maxLength={300}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">
              Options <span className="text-gray-600">(2–10)</span>
            </label>
            <div className="mt-1 space-y-2">
              {options.map((value, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    maxLength={120}
                    className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-600"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOptions((o) => o.filter((_, j) => j !== i))}
                      className="text-xs text-gray-500 hover:text-red-400"
                    >
                      remove
                    </button>
                  )}
                </div>
              ))}
              {options.length < 10 && (
                <button
                  type="button"
                  onClick={() => setOptions((o) => [...o, ""])}
                  className="text-xs text-purple-400 hover:underline"
                >
                  + add option
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">
              Closes at <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-600"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create poll"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
