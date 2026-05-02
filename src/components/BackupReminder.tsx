"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLastBackupAt } from "@/lib/backup";

const DISMISS_KEY = "tribe_backup_reminder_dismissed_until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export default function BackupReminder() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const lastBackup = getLastBackupAt();
    if (lastBackup) return;

    const dismissedUntil = parseInt(
      localStorage.getItem(DISMISS_KEY) ?? "0",
      10,
    );
    if (Number.isFinite(dismissedUntil) && Date.now() < dismissedUntil) return;

    setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_MS));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-amber-900">
            Back up your account
          </h3>
          <p className="mt-1 text-sm text-amber-800">
            If your browser data is wiped, you cannot recover this account
            without an encrypted backup. Takes 10 seconds.
          </p>
          <Link
            href="/settings"
            className="mt-3 inline-block text-xs font-bold text-amber-900 underline underline-offset-4"
          >
            Back up now
          </Link>
        </div>
        <button
          onClick={dismiss}
          className="text-xs text-amber-700 hover:text-amber-900"
          aria-label="Remind me later"
        >
          Later
        </button>
      </div>
    </div>
  );
}
