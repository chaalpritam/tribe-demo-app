"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { STORAGE_KEYS } from "@/lib/constants";
import { hubFetch } from "@/lib/failover";
import { fetchUser, uploadMedia, getMediaUrl } from "@/lib/api";

export default function SettingsPage() {
  const { connected } = useWallet();
  const [myTid, setMyTid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
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
        setDisplayName(user?.display_name ?? "");
        setBio(user?.bio ?? "");
        setAvatarUrl(user?.avatar_url ?? "");
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
        setAvatarUrl(getMediaUrl(result.hash));
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
    setSaving(true);
    setMessage(null);
    try {
      const res = await hubFetch(`/v1/user/${myTid}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName || null,
          bio: bio || null,
          avatarUrl: avatarUrl || null,
        }),
      });
      if (res.ok) {
        setMessage("Profile saved!");
      } else {
        const err = await res.json();
        setMessage(err.error ?? "Failed to save");
      }
    } catch {
      setMessage("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [myTid, displayName, bio, avatarUrl]);

  if (!connected) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-gray-500">Connect your wallet to edit your profile</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
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
            {avatarUrl ? (
              <img
                src={avatarUrl}
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

        {/* Display Name */}
        <div>
          <label htmlFor="display-name" className="block text-sm font-medium text-gray-300">
            Display Name
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={50}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-purple-600"
          />
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-300">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself"
            maxLength={160}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-purple-600"
          />
          <p className="mt-1 text-xs text-gray-500">
            {160 - bio.length} characters remaining
          </p>
        </div>

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
              message.includes("saved")
                ? "bg-green-900/30 text-green-400"
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
