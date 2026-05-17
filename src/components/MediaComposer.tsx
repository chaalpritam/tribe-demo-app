"use client";

import { useRef, useState } from "react";
import { uploadMedia } from "@/lib/api";
import { signAndPublishStory, signAndPublishTweet } from "@/lib/messages";
import { STORAGE_KEYS } from "@/lib/constants";

/// Modal composer for Stories + Reels.
///
/// Both modes share the same shape (file picker, caption, optional
/// extra field) so one component covers both — keeps the surface
/// area small and mirrors the iOS CreatePostView segmented picker.
///
/// Pipelines:
/// - story: image → uploadMedia → signAndPublishStory(media_hash, caption?, music?)
/// - reel:  video → uploadMedia → signAndPublishTweet(text, ..., postKind: 'reel', audioTitle?)
interface MediaComposerProps {
  mode: "story" | "reel";
  tid: number;
  onClose: () => void;
  onPublished?: () => void;
}

const STORY_CAPTION_MAX = 280;
const REEL_CAPTION_MAX = 320;
const STORY_MUSIC_MAX = 200;
const REEL_AUDIO_MAX = 200;

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

export default function MediaComposer({
  mode,
  tid,
  onClose,
  onPublished,
}: MediaComposerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [extra, setExtra] = useState(""); // music for story, audio_title for reel
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accept = mode === "story" ? "image/*" : "video/mp4,video/quicktime";
  const captionMax = mode === "story" ? STORY_CAPTION_MAX : REEL_CAPTION_MAX;
  const extraLabel = mode === "story" ? "Music" : "Audio title";
  const extraPlaceholder = mode === "story"
    ? "Optional · e.g. \"Track · Artist\""
    : "Optional · e.g. \"Original audio\"";
  const extraMax = mode === "story" ? STORY_MUSIC_MAX : REEL_AUDIO_MAX;

  const canSubmit = !!file && !submitting;

  const handlePublish = async () => {
    if (!file) return;
    const key = loadAppKey();
    if (!key) {
      setError("No app key — sign in first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const uploaded = await uploadMedia(file);
      if (mode === "story") {
        await signAndPublishStory({
          tid,
          mediaHash: uploaded.hash,
          caption: caption.trim() || undefined,
          music: extra.trim() || undefined,
          signingKeySecret: key,
        });
      } else {
        await signAndPublishTweet(
          tid,
          caption.trim(),
          key,
          undefined, // parentHash
          undefined, // channelId — defaults to "general"
          [`media:${uploaded.hash}`],
          "reel",
          undefined, // location
          extra.trim() || undefined
        );
      }
      onPublished?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === "story" ? "New story" : "New reel"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* File picker */}
        <div className="mb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
              <span className="text-xl">{mode === "story" ? "📷" : "🎬"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB · {file.type || "unknown"}
                </p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-sm text-gray-500 hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 text-gray-600 hover:border-gray-400 hover:text-gray-900"
            >
              <span className="text-2xl">{mode === "story" ? "📷" : "🎬"}</span>
              <span className="text-sm font-semibold">
                {mode === "story" ? "Choose a photo" : "Choose a video"}
              </span>
              <span className="text-xs text-gray-500">
                {mode === "story" ? "JPEG · PNG · GIF · WebP — max 5 MB" : "MP4 · MOV — max 100 MB"}
              </span>
            </button>
          )}
        </div>

        {/* Caption */}
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Caption</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, captionMax))}
            placeholder={
              mode === "story"
                ? "Add a story caption…"
                : "Write a reel caption…"
            }
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </label>

        {/* Music (story) / Audio title (reel) */}
        <label className="mt-3 block">
          <span className="text-xs font-medium text-gray-500">{extraLabel}</span>
          <input
            type="text"
            value={extra}
            onChange={(e) => setExtra(e.target.value.slice(0, extraMax))}
            placeholder={extraPlaceholder}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </label>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={!canSubmit}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {submitting ? "Publishing…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}
