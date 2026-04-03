"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const WalletButton = dynamic(
  async () => {
    const { WalletMultiButton } = await import(
      "@solana/wallet-adapter-react-ui"
    );
    return { default: WalletMultiButton };
  },
  {
    ssr: false,
    loading: () => (
      <button className="h-10 w-32 rounded-lg bg-purple-600 text-sm text-white">
        Loading...
      </button>
    ),
  }
);

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-800 bg-gray-950/80 px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-sm font-bold text-white">
            T
          </div>
          <span className="text-xl font-bold text-white">Tribe</span>
        </Link>

        <div className="hidden items-center gap-4 sm:flex">
          <Link
            href="/"
            className="text-sm text-gray-400 transition-colors hover:text-white"
          >
            Home
          </Link>
          <Link
            href="/explore"
            className="text-sm text-gray-400 transition-colors hover:text-white"
          >
            Explore
          </Link>
        </div>
      </div>

      <WalletButton
        style={{
          backgroundColor: "#7c3aed",
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          height: "2.5rem",
        }}
      />
    </nav>
  );
}
