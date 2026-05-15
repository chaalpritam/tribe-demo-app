"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveMediaUrl, getDmKey, Story } from "@/lib/api";
import {
  signAndViewStory,
  signAndSendDm,
  signAndRegisterDmKey,
} from "@/lib/messages";
import { encryptMessage, getDmPublicKey } from "@/lib/crypto";
import { STORAGE_KEYS } from "@/lib/constants";
import StoryViewersModal from "./StoryViewersModal";

/// Full-screen story viewer modal with multi-author swipe + auto-advance.
///
/// Props:
/// - `authors`: each entry is one author's stories in chronological order.
/// - `initialAuthorIndex`: which author the viewer opens at.
///
/// Navigation:
/// - Click left/right halves: prev / next story; at the edges, jumps to
///   prev / next author.
/// - Arrow keys: same.
/// - Escape: dismiss.
/// - Pointer down: pauses the auto-advance timer until pointer up.
///
/// Auto-advance: 5s per story. Pauses on mousedown / touchstart, resumes
/// on mouseup / touchend. Re-fires STORY_VIEW on first display of each
/// story per session (Set dedupe + hub-side idempotency).
interface StoryViewerProps {
  /** Single-author legacy shape — kept for the home page's
   *  pre-grouping path. Maps internally to a one-element authors[]. */
  stories?: Story[];
  /** Multi-author shape — preferred. */
  authors?: Story[][];
  initialAuthorIndex?: number;
  myTid?: number;
  onClose: () => void;
}

const STORY_DURATION_MS = 5000;
const TICK_MS = 50;

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

export default function StoryViewer({
  stories,
  authors: authorsProp,
  initialAuthorIndex = 0,
  myTid,
  onClose,
}: StoryViewerProps) {
  // Normalize to the multi-author shape internally.
  const authors = useMemo<Story[][]>(() => {
    if (authorsProp && authorsProp.length > 0) return authorsProp;
    if (stories && stories.length > 0) return [stories];
    return [];
  }, [authorsProp, stories]);

  const [authorIndex, setAuthorIndex] = useState(initialAuthorIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySent, setReplySent] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const pausedRef = useRef(false);
  const [, forceRender] = useState(0);
  const seenHashesRef = useRef<Set<string>>(new Set());

  const currentAuthorStories = authors[authorIndex] ?? [];
  const current = currentAuthorStories[storyIndex];

  // Reset progress + story index whenever the author changes.
  useEffect(() => {
    setStoryIndex(0);
    setProgress(0);
  }, [authorIndex]);

  useEffect(() => {
    setProgress(0);
  }, [storyIndex]);

  const goForward = useCallback(() => {
    setStoryIndex((i) => {
      if (i + 1 < currentAuthorStories.length) return i + 1;
      // End of this author — advance to next or close.
      setAuthorIndex((a) => {
        if (a + 1 < authors.length) return a + 1;
        onClose();
        return a;
      });
      return i;
    });
  }, [authors.length, currentAuthorStories.length, onClose]);

  const goBack = useCallback(() => {
    setStoryIndex((i) => {
      if (i > 0) return i - 1;
      // Start of this author — jump to the LAST story of the previous
      // author (IG behavior).
      setAuthorIndex((a) => {
        if (a > 0) {
          const prev = authors[a - 1] ?? [];
          setStoryIndex(Math.max(0, prev.length - 1));
          return a - 1;
        }
        onClose();
        return a;
      });
      return i;
    });
  }, [authors, onClose]);

  const nextAuthor = useCallback(() => {
    setAuthorIndex((a) => (a + 1 < authors.length ? a + 1 : a));
  }, [authors.length]);

  const prevAuthor = useCallback(() => {
    setAuthorIndex((a) => (a > 0 ? a - 1 : a));
  }, []);

  // Keyboard navigation.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goForward();
      else if (e.key === "ArrowLeft") goBack();
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.key === "ArrowDown" ? nextAuthor() : prevAuthor();
      } else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goForward, goBack, nextAuthor, prevAuthor, onClose]);

  // Auto-advance timer.
  useEffect(() => {
    const t = setInterval(() => {
      if (pausedRef.current) return;
      setProgress((p) => {
        const next = p + TICK_MS / STORY_DURATION_MS;
        if (next >= 1) {
          // Defer goForward so we don't update sibling state mid-render.
          queueMicrotask(() => goForward());
          return 0;
        }
        return next;
      });
      // Force a re-render so progress bar updates even when setProgress's
      // return value optimizes the bail-out.
      forceRender((n) => n + 1);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [goForward]);

  // Fire STORY_VIEW on first display of each story this session.
  useEffect(() => {
    if (!current || !myTid) return;
    if (seenHashesRef.current.has(current.hash)) return;
    seenHashesRef.current.add(current.hash);
    const key = loadAppKey();
    if (!key) return;
    signAndViewStory({
      tid: myTid,
      storyHash: current.hash,
      signingKeySecret: key,
    }).catch(() => {
      /* Soft-fail. */
    });
  }, [current, myTid]);

  const mediaUrl = useMemo(
    () => (current ? resolveMediaUrl(`media:${current.media_hash}`) : null),
    [current]
  );

  /// Encrypt + send a DM reply to the story's author. Mirrors the iOS
  /// TribeService.replyToStory shape: plaintext JSON carries the
  /// story_hash so a future inbox can anchor the reply.
  const handleReplySend = useCallback(
    async (story: Story) => {
      const text = replyDraft.trim();
      if (!text || myTid === undefined) return;

      const key = loadAppKey();
      if (!key) {
        setReplyError("No app key — sign in first.");
        return;
      }

      setIsReplying(true);
      setReplyError(null);
      try {
        // Make sure the recipient knows where to reach us back. The
        // hub is idempotent on the (tid, x25519_pubkey) key, so
        // re-registering on every reply is cheap.
        const myPub = getDmPublicKey(myTid);
        try {
          await signAndRegisterDmKey(myTid, myPub, key);
        } catch {
          /* non-fatal — recipient still gets our key via sender_x25519 */
        }

        const recipientPub = await getDmKey(String(story.author_tid));
        if (!recipientPub) {
          setReplyError("This user hasn't set up DMs on the hub yet.");
          return;
        }

        const plaintext = JSON.stringify({ text, story_hash: story.hash });
        const { encrypted, nonce } = encryptMessage(
          plaintext,
          recipientPub,
          myTid
        );

        await signAndSendDm({
          senderTid: myTid,
          recipientTid: Number(story.author_tid),
          ciphertext: encrypted,
          nonce,
          senderX25519: myPub,
          signingKeySecret: key,
        });

        setReplyDraft("");
        setReplySent(true);
      } catch (e) {
        setReplyError(e instanceof Error ? e.message : "Send failed");
      } finally {
        setIsReplying(false);
      }
    },
    [replyDraft, myTid]
  );

  if (!current) {
    // Empty state — should be rare, but safe to render rather than
    // crash if authors[][] turns out empty.
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white"
        onClick={onClose}
      >
        No stories.
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onMouseDown={() => { pausedRef.current = true; }}
      onMouseUp={() => { pausedRef.current = false; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={() => { pausedRef.current = true; }}
      onTouchEnd={() => { pausedRef.current = false; }}
    >
      {/* Progress bars across the top — one per story for the current
          author. Filled fully for past stories, partial for current. */}
      <div className="absolute left-4 right-4 top-3 z-10 flex gap-1">
        {currentAuthorStories.map((_, idx) => (
          <div key={idx} className="relative h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white"
              style={{
                width:
                  idx < storyIndex ? "100%" :
                  idx === storyIndex ? `${progress * 100}%` :
                  "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute left-4 right-4 top-8 z-10 flex items-center gap-3 text-white">
        <span className="text-sm font-semibold">
          {current.username ?? `tid${current.author_tid}`}
        </span>
        <span className="text-xs opacity-70">
          {relativeTime(current.created_at)}
        </span>
        <span className="ml-auto flex items-center gap-3">
          {authors.length > 1 && (
            <span className="text-xs opacity-70">
              {authorIndex + 1} / {authors.length}
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </span>
      </div>

      {/* Image */}
      {mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt=""
          className="max-h-screen max-w-full object-contain"
        />
      )}

      {/* Caption */}
      {current.caption && (
        <div className="absolute bottom-12 left-0 right-0 z-10 flex justify-center px-6">
          <span className="rounded-full bg-black/50 px-4 py-2 text-sm text-white">
            {current.caption}
          </span>
        </div>
      )}

      {/* Author-only "Seen by" footer. Sits on top of the right tap zone
          (z-20 vs z-0) so the click lands here instead of advancing. */}
      {myTid !== undefined && Number(current.author_tid) === myTid && (
        <button
          onClick={() => setShowViewers(true)}
          className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm text-white hover:bg-black/70"
        >
          <span aria-hidden>👁</span>
          <span className="font-semibold">Seen by</span>
          <span aria-hidden>↑</span>
        </button>
      )}

      {showViewers && current && myTid !== undefined && (
        <StoryViewersModal
          storyHash={current.hash}
          myTid={myTid}
          onClose={() => setShowViewers(false)}
        />
      )}

      {/* DM reply composer — non-own stories only, signed-in only. The
          ticker keeps running while the user types (we don't have an
          easy hook to pause it that survives input focus), but it's
          short enough the impact is small. */}
      {myTid !== undefined && Number(current.author_tid) !== myTid && (
        <form
          className="absolute bottom-3 left-1/2 z-20 flex w-[min(420px,90vw)] -translate-x-1/2 flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            handleReplySend(current);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 rounded-full border border-white/40 bg-white/15 px-2 backdrop-blur-sm">
            <input
              type="text"
              value={replyDraft}
              onChange={(e) => {
                setReplyDraft(e.target.value);
                if (replySent) setReplySent(false);
              }}
              onFocus={() => { setReplyFocused(true); pausedRef.current = true; }}
              onBlur={() => { setReplyFocused(false); pausedRef.current = false; }}
              placeholder={replySent ? "Sent. Send another?" : "Reply to story"}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none"
            />
            {isReplying ? (
              <span className="px-2 text-xs text-white/80">…</span>
            ) : replyDraft.trim().length > 0 ? (
              <button
                type="submit"
                aria-label="Send reply"
                className="p-2 text-white hover:opacity-80"
              >
                ➤
              </button>
            ) : null}
          </div>
          {replyError && (
            <span className="px-3 text-xs text-red-300">{replyError}</span>
          )}
        </form>
      )}

      {/* Tap zones — left = back, right = forward */}
      <button
        onClick={goBack}
        className="absolute bottom-0 left-0 top-12 z-0 w-1/2 cursor-default"
        aria-label="Previous story"
      />
      <button
        onClick={goForward}
        className="absolute bottom-0 right-0 top-12 z-0 w-1/2 cursor-default"
        aria-label="Next story"
      />
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
