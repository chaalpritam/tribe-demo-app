"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

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
      <div className="h-9 w-24 rounded-md bg-gray-200" />
    ),
  }
);

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
      <WalletButton
        style={{
          backgroundColor: "#18181b",
          borderRadius: "0.5rem",
          fontSize: "0.75rem",
          height: "2.25rem",
          padding: "0 0.75rem",
        }}
      />
    </header>
  );
}
