"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { STORAGE_KEYS } from "@/lib/constants";
import { fetchUser, uploadMedia, mediaRef, resolveMediaUrl } from "@/lib/api";
import { signAndPublishUserData, type ProfileField } from "@/lib/messages";

interface ProfileForm {
  displayName: string;
  bio: string;
  pfpUrl: string;
  url: string;
  location: string;
  city: string;
}

const EMPTY_FORM: ProfileForm = {
  displayName: "",
  bio: "",
  pfpUrl: "",
  url: "",
  location: "",
  city: "",
};

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

export default function SettingsPage() {
  const { connected } = useWallet();
  const [myTid, setMyTid] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  // Snapshot of what's on the server — used to compute which fields
  // actually changed so we only re-publish what's needed.
  const [original, setOriginal] = useState<ProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (stored) setMyTid(stored);
  }, []);

  useEffect(() => {
    if (!myTid) return;
    setLoading(true);
    fetchUser(myTid)
      .then((user) => {
        // Hub's /v1/user/:tid returns { ...tid_row, profile: {field: value} }
        // where field uses protocol names (displayName, pfpUrl, etc.).
        const p = (user?.profile ?? {}) as Record<string, string>;
        const next: ProfileForm = {
          displayName: p.displayName ?? "",
          bio: p.bio ?? "",
          pfpUrl: p.pfpUrl ?? "",
          url: p.url ?? "",
          location: p.location ?? "",
          city: p.city ?? "",
        };
        setForm(next);
        setOriginal(next);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [myTid]);

  const handleAvatarUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const result = await uploadMedia(file);
        // Store the canonical reference, not the absolute URL — see
        // mediaRef in lib/api for the rationale (hub IP change safety).
        setForm((f) => ({ ...f, pfpUrl: mediaRef(result.hash) }));
      } catch {
        setMessage("Failed to upload avatar");
      } finally {
        setUploading(false);
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!myTid) return;
    const appKey = loadAppKey();
    if (!appKey) {
      setMessage("No app key — register your identity first");
      return;
    }
    setSaving(true);
    setMessage(null);

    const tid = parseInt(myTid, 10);
    const fields: ProfileField[] = [
      "displayName",
      "bio",
      "pfpUrl",
      "url",
      "location",
      "city",
    ];
    // Only re-publish fields whose value changed since load — saves
    // hub round-trips and avoids cluttering user_data with no-op rows.
    const changed = fields.filter((k) => form[k] !== original[k]);

    if (changed.length === 0) {
      setMessage("No changes to save");
      setSaving(false);
      return;
    }

    try {
      for (const field of changed) {
        await signAndPublishUserData({
          tid,
          field,
          value: form[field],
          signingKeySecret: appKey,
        });
      }
      setOriginal(form);
      setMessage(`Saved ${changed.length} field${changed.length === 1 ? "" : "s"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setMessage(msg);
    } finally {
      setSaving(false);
    }
  }, [myTid, form, original]);

  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Connect your wallet to edit your profile</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold text-white">Edit Profile</h1>

      <div className="mt-6 space-y-4">
        {/* Avatar */}
        <div>
          <label className="block text-sm font-medium text-gray-300">
            Avatar
          </label>
          <div className="mt-2 flex items-center gap-4">
            {form.pfpUrl ? (
              <img
                src={resolveMediaUrl(form.pfpUrl) ?? ""}
                alt="Avatar"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 text-xl font-bold text-white">
                {myTid}
              </div>
            )}
            <label className="cursor-pointer rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700">
              {uploading ? "Uploading..." : "Change avatar"}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <Field
          label="Display name"
          value={form.displayName}
          maxLength={50}
          onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
          placeholder="Your name"
        />

        <Field
          label="Bio"
          value={form.bio}
          maxLength={160}
          rows={3}
          onChange={(v) => setForm((f) => ({ ...f, bio: v }))}
          placeholder="Tell people about yourself"
          showCharCount
        />

        <Field
          label="Website"
          value={form.url}
          maxLength={200}
          onChange={(v) => setForm((f) => ({ ...f, url: v }))}
          placeholder="https://yourwebsite.com"
        />

        <Field
          label="Location"
          value={form.location}
          maxLength={80}
          onChange={(v) => setForm((f) => ({ ...f, location: v }))}
          placeholder="Where you're based"
        />

        <Field
          label="City"
          value={form.city}
          maxLength={80}
          onChange={(v) => setForm((f) => ({ ...f, city: v }))}
          placeholder="Your hyperlocal channel"
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>

        {message && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              message.startsWith("Saved")
                ? "bg-green-900/30 text-green-400"
                : message === "No changes to save"
                  ? "bg-gray-800 text-gray-300"
                  : "bg-red-900/30 text-red-400"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  showCharCount?: boolean;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows,
  showCharCount,
}: FieldProps) {
  const inputClass =
    "mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-purple-600";
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          className={`${inputClass} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={inputClass}
        />
      )}
      {showCharCount && maxLength !== undefined && (
        <p className="mt-1 text-xs text-gray-500">
          {maxLength - value.length} characters remaining
        </p>
      )}
    </div>
  );
}
