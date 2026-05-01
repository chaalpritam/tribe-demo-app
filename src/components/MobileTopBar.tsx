"use client";

import WalletButton from "./WalletButton";
import Link from "next/link";

export default function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-2 backdrop-blur-sm md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white">
          T
        </div>
        <span className="text-base font-bold tracking-tight text-gray-900">
          Tribe
        </span>
      </Link>
      <WalletButton className="text-xs h-8 px-3" label="Login" />
    </header>
  );
}
