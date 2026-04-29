"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  fetchTasks,
  type TaskRow,
  type TaskStatus,
} from "@/lib/api";
import {
  signAndClaimTask,
  signAndCompleteTask,
  signAndCreateTask,
} from "@/lib/messages";
import { STORAGE_KEYS } from "@/lib/constants";

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

const TASK_ID_RE = /^[a-z0-9-]{1,64}$/;

export default function TasksPage() {
  const { connected } = useWallet();
  const [myTid, setMyTid] = useState<number | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<TaskStatus | "all">("open");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTasks(filter === "all" ? undefined : filter)
      .then(({ tasks }) => setTasks(tasks))
      .finally(() => setLoading(false));
  }, [refreshKey, filter]);

  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Connect your wallet to view tasks</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="mt-1 text-sm text-gray-400">
            Things to do, posted by people on the network
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

      <div className="mt-4 inline-flex rounded-lg border border-gray-800 bg-gray-900 p-1">
        {(["open", "claimed", "completed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm capitalize ${
              filter === f
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">No {filter === "all" ? "" : filter} tasks.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              myTid={myTid}
              onUpdated={() => setRefreshKey((k) => k + 1)}
            />
          ))}
        </div>
      )}

      {showCreate && myTid !== null && (
        <CreateTaskModal
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

interface TaskCardProps {
  task: TaskRow;
  myTid: number | null;
  onUpdated: () => void;
}

function TaskCard({ task, myTid, onUpdated }: TaskCardProps) {
  const [submitting, setSubmitting] = useState(false);

  const isCreator = myTid !== null && String(myTid) === task.creator_tid;
  const isClaimer = myTid !== null && task.claimed_by_tid === String(myTid);
  const canClaim = task.status === "open" && myTid !== null && !isCreator;
  const canComplete =
    task.status === "claimed" && myTid !== null && (isClaimer || isCreator);

  const handleClaim = useCallback(async () => {
    if (myTid === null || submitting) return;
    const appKey = loadAppKey();
    if (!appKey) return;
    setSubmitting(true);
    try {
      await signAndClaimTask({
        tid: myTid,
        taskId: task.id,
        signingKeySecret: appKey,
      });
      onUpdated();
    } catch (err) {
      console.error("Task claim failed:", err);
    } finally {
      setSubmitting(false);
    }
  }, [myTid, submitting, task.id, onUpdated]);

  const handleComplete = useCallback(async () => {
    if (myTid === null || submitting) return;
    const appKey = loadAppKey();
    if (!appKey) return;
    setSubmitting(true);
    try {
      await signAndCompleteTask({
        tid: myTid,
        taskId: task.id,
        signingKeySecret: appKey,
      });
      onUpdated();
    } catch (err) {
      console.error("Task complete failed:", err);
    } finally {
      setSubmitting(false);
    }
  }, [myTid, submitting, task.id, onUpdated]);

  const statusBadge =
    task.status === "open"
      ? { label: "open", color: "bg-blue-500/20 text-blue-300" }
      : task.status === "claimed"
        ? { label: "claimed", color: "bg-yellow-500/20 text-yellow-300" }
        : { label: "completed", color: "bg-green-500/20 text-green-300" };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white">{task.title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadge.color}`}
            >
              {statusBadge.label}
            </span>
          </div>
          {task.description && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-300">
              {task.description}
            </p>
          )}
          {task.reward_text && (
            <p className="mt-1 text-xs text-gray-400">
              💰 {task.reward_text}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            By TID #{task.creator_tid}
            {task.claimed_by_tid && (
              <> · claimed by #{task.claimed_by_tid}</>
            )}
            {task.completed_by_tid && (
              <> · completed by #{task.completed_by_tid}</>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {canClaim && (
            <button
              onClick={handleClaim}
              disabled={submitting}
              className="rounded-full bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              Claim
            </button>
          )}
          {canComplete && (
            <button
              onClick={handleComplete}
              disabled={submitting}
              className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              Mark done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface CreateTaskModalProps {
  tid: number;
  onClose: () => void;
  onCreated: () => void;
}

function CreateTaskModal({ tid, onClose, onCreated }: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardText, setRewardText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const appKey = loadAppKey();
    if (!appKey) {
      setError("No app key — register your identity first");
      return;
    }
    const slug = `t-${Math.random().toString(36).slice(2, 10)}-${Date.now()
      .toString(36)
      .slice(-4)}`;
    if (!TASK_ID_RE.test(slug)) {
      setError("Could not generate a valid task id");
      return;
    }
    setSubmitting(true);
    try {
      await signAndCreateTask({
        tid,
        taskId: slug,
        title: title.trim(),
        description: description.trim() || undefined,
        rewardText: rewardText.trim() || undefined,
        signingKeySecret: appKey,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }, [title, description, rewardText, tid, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New task</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Translate the README to French"
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              className="mt-1 w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">
              Reward <span className="text-gray-600">(free text — what they get for it)</span>
            </label>
            <input
              type="text"
              value={rewardText}
              onChange={(e) => setRewardText(e.target.value)}
              placeholder="0.5 SOL on completion"
              maxLength={120}
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
              {submitting ? "Creating…" : "Post task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
