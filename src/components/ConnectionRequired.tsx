"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "./WalletButton";
import { STORAGE_KEYS } from "@/lib/constants";
import { useEffect, useState } from "react";

interface ConnectionRequiredProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function ConnectionRequired({
  children,
  title = "Authentication Required",
  description = "Connect your wallet to access this page",
}: ConnectionRequiredProps) {
  const { connected, connecting } = useWallet();
  const [hasExistingAccount, setHasExistingAccount] = useState(false);

  useEffect(() => {
    setHasExistingAccount(!!localStorage.getItem(STORAGE_KEYS.tid));
  }, []);

  if (connected) {
    return <>{children}</>;
  }

  if (hasExistingAccount || connecting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-900 border-t-transparent" />
        <h2 className="mt-6 text-xl font-bold text-gray-900">
          {connecting ? "Connecting..." : "Waking up your account..."}
        </h2>
        <p className="mt-2 text-gray-500">This usually takes less than a second.</p>
        <div className="mt-10">
          <WalletButton className="opacity-0 hover:opacity-100 transition-opacity" label="Click if stuck" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-900 text-3xl font-bold text-white">
        T
      </div>
      <h1 className="mt-6 text-3xl font-bold text-gray-900">{title}</h1>
      <p className="mt-3 max-w-md text-lg text-gray-600">{description}</p>
      <div className="mt-8">
        <WalletButton className="h-11 px-8 text-base" label="Join Tribe" />
      </div>
    </div>
  );
}
