"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { getTidByCustody } from "@/lib/tribe";
import { STORAGE_KEYS } from "@/lib/constants";
import ProfileSidebar from "@/components/ProfileSidebar";
import TweetComposer from "@/components/TweetComposer";
import Feed from "@/components/Feed";
import RegisterIdentity from "@/components/RegisterIdentity";
import ImportBackup from "@/components/ImportBackup";

const WalletButton = dynamic(
  async () => {
    const { WalletMultiButton } = await import(
      "@solana/wallet-adapter-react-ui"
    );
    return { default: WalletMultiButton };
  },
  {
    ssr: false,
    loading: () => <div className="mt-10 h-10 w-40 rounded-lg bg-gray-200" />,
  }
);

export default function Home() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [tid, setTid] = useState<number | null>(null);
  const [hasAppKey, setHasAppKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const checkTid = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const walletKey = publicKey.toBase58();
      const storedTid = localStorage.getItem(STORAGE_KEYS.tid);
      const storedWallet = localStorage.getItem(STORAGE_KEYS.tidWallet);

      // Use cached TID only if it belongs to the current wallet
      if (storedTid && storedWallet === walletKey) {
        setTid(parseInt(storedTid, 10));
        setHasAppKey(!!localStorage.getItem(STORAGE_KEYS.appKeySecret));
        setLoading(false);
        return;
      }

      // Clear stale cache from a different wallet
      if (storedTid && storedWallet !== walletKey) {
        localStorage.removeItem(STORAGE_KEYS.tid);
        localStorage.removeItem(STORAGE_KEYS.appKeySecret);
        localStorage.removeItem(STORAGE_KEYS.tidWallet);
      }

      // Check on-chain
      const onChainTid = await getTidByCustody(connection, publicKey);
      if (onChainTid !== null) {
        setTid(onChainTid);
        localStorage.setItem(STORAGE_KEYS.tid, onChainTid.toString());
        localStorage.setItem(STORAGE_KEYS.tidWallet, walletKey);
        setHasAppKey(!!localStorage.getItem(STORAGE_KEYS.appKeySecret));
      }
    } catch {
      // TID not found
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      checkTid();
    } else {
      setTid(null);
      setHasAppKey(false);
    }
  }, [connected, publicKey, checkTid]);

  const handleTweetPublished = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleRegistered = useCallback((newTid: number) => {
    setTid(newTid);
    setHasAppKey(true);
  }, []);

  // Not connected - hero section
  if (!connected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-900 text-3xl font-bold text-white">
          T
        </div>
        <h1 className="mt-6 text-4xl font-bold text-gray-900">
          Welcome to Tribe
        </h1>
        <p className="mt-3 max-w-md text-center text-lg text-gray-600">
          A decentralized social protocol built on Solana. Own your identity,
          your data, and your social graph.
        </p>

        <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <div className="text-base font-semibold text-gray-900">On-chain</div>
            <p className="mt-1 text-sm text-gray-500">
              Identity & social graph stored on Solana.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <div className="text-base font-semibold text-gray-900">Self-owned</div>
            <p className="mt-1 text-sm text-gray-500">
              Your keys, your data, your network.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
            <div className="text-base font-semibold text-gray-900">Fast</div>
            <p className="mt-1 text-sm text-gray-500">
              Ephemeral rollups for instant interactions.
            </p>
          </div>
        </div>

        <p className="mt-10 text-gray-500">
          Connect your wallet to get started
        </p>
        <div className="mt-4 flex flex-col items-center gap-4">
          <WalletButton
            style={{
              backgroundColor: "#18181b",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              height: "2.75rem",
              padding: "0 1.25rem",
            }}
          />
          <ImportBackup />
        </div>
      </div>
    );
  }

  // Loading TID
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
      </div>
    );
  }

  // No TID - registration flow (start from beginning)
  if (tid === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <RegisterIdentity onRegistered={handleRegistered} />
      </div>
    );
  }

  // Has TID but no app key - resume registration at app key step
  if (!hasAppKey) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <RegisterIdentity
          onRegistered={handleRegistered}
          initialStep="appkey"
          existingTid={tid}
        />
      </div>
    );
  }

  // Main feed view: feed centered, profile rail on xl+
  return (
    <div className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
      <div className="min-w-0 flex-1 max-w-2xl">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <TweetComposer tid={tid} onTweetPublished={handleTweetPublished} />
          <Feed myTid={tid} refreshKey={refreshKey} />
        </div>
      </div>
      <aside className="hidden w-72 shrink-0 xl:block">
        <div className="sticky top-4">
          <ProfileSidebar
            tid={tid.toString()}
            walletAddress={publicKey?.toBase58() ?? ""}
          />
        </div>
      </aside>
    </div>
  );
}
