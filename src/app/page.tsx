"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { getTidByCustody } from "@/lib/tribe";
import { STORAGE_KEYS } from "@/lib/constants";
import ProfileSidebar from "@/components/ProfileSidebar";
import TweetComposer from "@/components/TweetComposer";
import Feed from "@/components/Feed";
import RegisterIdentity from "@/components/RegisterIdentity";

export default function Home() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [tid, setTid] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const checkTid = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      // Check localStorage first
      const storedTid = localStorage.getItem(STORAGE_KEYS.tid);
      if (storedTid) {
        setTid(parseInt(storedTid, 10));
        setLoading(false);
        return;
      }

      // Check on-chain
      const onChainTid = await getTidByCustody(connection, publicKey);
      if (onChainTid !== null) {
        setTid(onChainTid);
        localStorage.setItem(STORAGE_KEYS.tid, onChainTid.toString());
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
    }
  }, [connected, publicKey, checkTid]);

  const handleTweetPublished = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleRegistered = useCallback((newTid: number) => {
    setTid(newTid);
  }, []);

  // Not connected - hero section
  if (!connected) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-600 text-3xl font-bold text-white">
          T
        </div>
        <h1 className="mt-6 text-4xl font-bold text-white">
          Welcome to Tribe
        </h1>
        <p className="mt-3 max-w-md text-center text-lg text-gray-400">
          A decentralized social protocol built on Solana. Own your identity,
          your data, and your social graph.
        </p>
        <p className="mt-8 text-gray-500">
          Connect your wallet to get started
        </p>
      </div>
    );
  }

  // Loading TID
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
      </div>
    );
  }

  // No TID - registration flow
  if (tid === null) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4">
        <RegisterIdentity onRegistered={handleRegistered} />
      </div>
    );
  }

  // Main feed view
  return (
    <div className="flex min-h-[calc(100vh-64px)] gap-6 px-4 py-6">
      {/* Sidebar */}
      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-20">
          <ProfileSidebar
            tid={tid.toString()}
            walletAddress={publicKey?.toBase58() ?? ""}
          />
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="rounded-xl border border-gray-800 bg-gray-900">
          <TweetComposer tid={tid} onTweetPublished={handleTweetPublished} />
          <Feed refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
