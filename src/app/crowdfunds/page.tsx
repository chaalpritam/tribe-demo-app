"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  fetchCrowdfunds,
  type CrowdfundRow,
} from "@/lib/api";
import {
  signAndCreateCrowdfund,
  signAndPledgeCrowdfund,
} from "@/lib/messages";
import { STORAGE_KEYS } from "@/lib/constants";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

const ID_RE = /^[a-z0-9-]{1,64}$/;

export default function CrowdfundsPage() {
  const { connected } = useWallet();
  const [myTid, setMyTid] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<CrowdfundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [pledging, setPledging] = useState<CrowdfundRow | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCrowdfunds()
      .then(({ crowdfunds }) => setCampaigns(crowdfunds))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Connect your wallet to view crowdfunds</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader
        title="Crowdfunds"
        subtitle="Community-funded campaigns"
        action={
          myTid !== null ? (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              + New crowdfund
            </button>
          ) : null
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : campaigns.length === 0 ? (
        <EmptyState
          title="No crowdfunds yet"
          body="Rally the network around something worth pooling resources for."
          action={
            myTid !== null ? (
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Start a crowdfund
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((cf) => (
            <CrowdfundCard
              key={cf.id}
              campaign={cf}
              onPledgeClick={() => setPledging(cf)}
            />
          ))}
        </div>
      )}

      {showCreate && myTid !== null && (
        <CreateCrowdfundModal
          tid={myTid}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {pledging && myTid !== null && (
        <PledgeModal
          tid={myTid}
          campaign={pledging}
          onClose={() => setPledging(null)}
          onPledged={() => {
            setPledging(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

interface CrowdfundCardProps {
  campaign: CrowdfundRow;
  onPledgeClick: () => void;
}

function CrowdfundCard({ campaign, onPledgeClick }: CrowdfundCardProps) {
  const raised = Number(campaign.raised_amount ?? 0);
  const goal = Number(campaign.goal_amount ?? 0);
  const pct = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;
  const deadlinePassed = campaign.deadline_at
    ? new Date(campaign.deadline_at).getTime() < Date.now()
    : false;
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">{campaign.title}</p>
          {campaign.description && (
            <p className="mt-1 text-sm text-gray-300">{campaign.description}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            By TID #{campaign.creator_tid}
            {campaign.deadline_at && (
              <>
                {" "}· {deadlinePassed ? "ended" : "ends"}{" "}
                {new Date(campaign.deadline_at).toLocaleDateString()}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-900">
            <span className="font-semibold">{fmt(raised)}</span>
            <span className="text-gray-500"> / {fmt(goal)} {campaign.currency}</span>
          </span>
          <span className="text-gray-500">
            {Math.round(pct)}% · {campaign.pledger_count} {campaign.pledger_count === 1 ? "pledger" : "pledgers"}
          </span>
        </div>
      </div>

      {!deadlinePassed && (
        <button
          onClick={onPledgeClick}
          className="mt-3 w-full rounded-lg bg-gray-900 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Pledge
        </button>
      )}
    </div>
  );
}

interface CreateCrowdfundModalProps {
  tid: number;
  onClose: () => void;
  onCreated: () => void;
}

function CreateCrowdfundModal({ tid, onClose, onCreated }: CreateCrowdfundModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const goal = Number(goalAmount);
    if (!Number.isFinite(goal) || goal <= 0) {
      setError("Goal amount must be positive");
      return;
    }
    const appKey = loadAppKey();
    if (!appKey) {
      setError("No app key — register your identity first");
      return;
    }
    const slug = `c-${Math.random().toString(36).slice(2, 10)}-${Date.now()
      .toString(36)
      .slice(-4)}`;
    if (!ID_RE.test(slug)) {
      setError("Could not generate a valid id");
      return;
    }
    let deadlineUnix: number | undefined;
    if (deadline) {
      const t = new Date(deadline).getTime();
      if (Number.isFinite(t)) deadlineUnix = Math.floor(t / 1000);
    }
    setSubmitting(true);
    try {
      await signAndCreateCrowdfund({
        tid,
        crowdfundId: slug,
        title: title.trim(),
        description: description.trim() || undefined,
        goalAmount: goal,
        currency: currency.trim() || "USD",
        deadlineAtUnix: deadlineUnix,
        signingKeySecret: appKey,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create crowdfund");
    } finally {
      setSubmitting(false);
    }
  }, [title, description, goalAmount, currency, deadline, tid, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">New crowdfund</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900" aria-label="Close">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Fund the new community garden"
              maxLength={120}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              className="mt-1 w-full resize-none rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500">Goal</label>
              <input
                type="text"
                inputMode="decimal"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
                placeholder="500"
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">Currency</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="USD"
                maxLength={20}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500">
              Deadline <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-300 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Launch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PledgeModalProps {
  tid: number;
  campaign: CrowdfundRow;
  onClose: () => void;
  onPledged: () => void;
}

function PledgeModal({ tid, campaign, onClose, onPledged }: PledgeModalProps) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Pledge amount must be positive");
      return;
    }
    const appKey = loadAppKey();
    if (!appKey) {
      setError("No app key — register your identity first");
      return;
    }
    setSubmitting(true);
    try {
      await signAndPledgeCrowdfund({
        tid,
        crowdfundId: campaign.id,
        amount: n,
        currency: campaign.currency,
        signingKeySecret: appKey,
      });
      onPledged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pledge failed");
    } finally {
      setSubmitting(false);
    }
  }, [amount, tid, campaign.id, campaign.currency, onPledged]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Pledge</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900" aria-label="Close">✕</button>
        </div>
        <p className="mt-2 text-sm text-gray-500">to <span className="text-gray-900">{campaign.title}</span></p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">Amount ({campaign.currency})</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              autoFocus
            />
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            This records an off-chain pledge. The actual fund movement
            isn&apos;t handled by this envelope — use the on-chain
            crowdfund-registry program for real settlement.
          </p>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-300 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "Pledging…" : "Confirm pledge"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
