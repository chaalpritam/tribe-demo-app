"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  fetchEvent,
  fetchEvents,
  fetchUserRsvp,
  type EventRow,
} from "@/lib/api";
import { signAndCreateEvent, signAndRsvpEvent, type RsvpStatus } from "@/lib/messages";
import { STORAGE_KEYS } from "@/lib/constants";

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

const EVENT_ID_RE = /^[a-z0-9-]{1,64}$/;

export default function EventsPage() {
  const { connected } = useWallet();
  const [myTid, setMyTid] = useState<number | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"upcoming" | "all">("upcoming");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(parseInt(stored, 10));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchEvents(filter === "upcoming")
      .then(({ events }) => setEvents(events))
      .finally(() => setLoading(false));
  }, [refreshKey, filter]);

  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Connect your wallet to view events</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="mt-1 text-sm text-gray-500">
            What&apos;s happening on the network
          </p>
        </div>
        {myTid !== null && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            + New
          </button>
        )}
      </div>

      <div className="mt-4 inline-flex rounded-lg border border-gray-200 bg-white p-1">
        {(["upcoming", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm ${
              filter === f ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {f === "upcoming" ? "Upcoming" : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
        </div>
      ) : events.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">
            {filter === "upcoming" ? "No upcoming events." : "No events yet."}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Click <span className="text-blue-600">+ New</span> to schedule one.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} myTid={myTid} onRsvped={() => setRefreshKey((k) => k + 1)} />
          ))}
        </div>
      )}

      {showCreate && myTid !== null && (
        <CreateEventModal
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

interface EventCardProps {
  event: EventRow;
  myTid: number | null;
  onRsvped: () => void;
}

function EventCard({ event, myTid, onRsvped }: EventCardProps) {
  const [counts, setCounts] = useState<Record<RsvpStatus, number>>({
    yes: 0,
    no: 0,
    maybe: 0,
  });
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEvent(event.id).then((e) => {
      if (cancelled) return;
      if (e?.rsvp_counts) setCounts(e.rsvp_counts);
    });
    if (myTid !== null) {
      fetchUserRsvp(event.id, String(myTid)).then((r) => {
        if (cancelled) return;
        if (r) setMyStatus(r.status);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [event.id, myTid]);

  const handleRsvp = useCallback(
    async (status: RsvpStatus) => {
      if (myTid === null || submitting) return;
      const appKey = loadAppKey();
      if (!appKey) return;
      const previous = myStatus;
      setMyStatus(status);
      setCounts((c) => {
        const next = { ...c };
        if (previous && previous !== status) next[previous] = Math.max(0, next[previous] - 1);
        if (previous !== status) next[status] = (next[status] ?? 0) + 1;
        return next;
      });
      setSubmitting(true);
      try {
        await signAndRsvpEvent({
          tid: myTid,
          eventId: event.id,
          status,
          signingKeySecret: appKey,
        });
        onRsvped();
      } catch (err) {
        console.error("RSVP failed:", err);
        setMyStatus(previous);
      } finally {
        setSubmitting(false);
      }
    },
    [myTid, myStatus, submitting, event.id, onRsvped],
  );

  const startsAt = new Date(event.starts_at);
  const endsAt = event.ends_at ? new Date(event.ends_at) : null;
  const inPast = startsAt.getTime() < Date.now();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">{event.title}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {startsAt.toLocaleString()}
            {endsAt && <> – {endsAt.toLocaleTimeString()}</>}
            {inPast && <span className="ml-2 text-gray-500">· past</span>}
          </p>
          {event.location_text && (
            <p className="mt-0.5 text-xs text-gray-500">📍 {event.location_text}</p>
          )}
          {event.description && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
              {event.description}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-gray-500">TID #{event.creator_tid}</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {(["yes", "maybe", "no"] as const).map((status) => {
          const isMine = myStatus === status;
          return (
            <button
              key={status}
              onClick={() => handleRsvp(status)}
              disabled={submitting || myTid === null || inPast}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                isMine
                  ? status === "yes"
                    ? "bg-emerald-600 text-white"
                    : status === "maybe"
                      ? "bg-amber-500 text-white"
                      : "bg-gray-600 text-white"
                  : "border border-gray-200 text-gray-700 hover:bg-gray-100"
              } ${inPast ? "opacity-50" : ""}`}
            >
              {status === "yes" ? "Going" : status === "maybe" ? "Maybe" : "Can't go"}
              <span className="ml-1.5 text-[10px] opacity-75">{counts[status] ?? 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CreateEventModalProps {
  tid: number;
  onClose: () => void;
  onCreated: () => void;
}

function CreateEventModal({ tid, onClose, onCreated }: CreateEventModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationText, setLocationText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!startsAt) {
      setError("Start time is required");
      return;
    }
    const startsUnix = Math.floor(new Date(startsAt).getTime() / 1000);
    if (!Number.isFinite(startsUnix) || startsUnix <= 0) {
      setError("Invalid start time");
      return;
    }
    let endsUnix: number | undefined;
    if (endsAt) {
      endsUnix = Math.floor(new Date(endsAt).getTime() / 1000);
      if (!Number.isFinite(endsUnix) || endsUnix <= startsUnix) {
        setError("End time must be after start");
        return;
      }
    }
    const appKey = loadAppKey();
    if (!appKey) {
      setError("No app key — register your identity first");
      return;
    }

    const slug = `e-${Math.random().toString(36).slice(2, 10)}-${Date.now()
      .toString(36)
      .slice(-4)}`;
    if (!EVENT_ID_RE.test(slug)) {
      setError("Could not generate a valid event id");
      return;
    }

    setSubmitting(true);
    try {
      await signAndCreateEvent({
        tid,
        eventId: slug,
        title: title.trim(),
        description: description.trim() || undefined,
        startsAtUnix: startsUnix,
        endsAtUnix: endsUnix,
        locationText: locationText.trim() || undefined,
        signingKeySecret: appKey,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  }, [title, description, startsAt, endsAt, locationText, tid, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">New event</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900" aria-label="Close">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tribe meetup"
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
              <label className="block text-xs font-medium text-gray-500">Starts at</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Ends at <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500">
              Location <span className="text-gray-600">(optional, free text)</span>
            </label>
            <input
              type="text"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder="Coffee on Castro"
              maxLength={200}
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
              {submitting ? "Creating…" : "Create event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
