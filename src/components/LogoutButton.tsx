"use client";

import { useSignOut } from "@/lib/auth";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const signOut = useSignOut();

  return (
    <button
      onClick={signOut}
      className={
        className ||
        "w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-red-600 transition-colors"
      }
    >
      Logout
    </button>
  );
}
