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
import ImportBackup from "@/components/ImportBackup";

import WalletButton from "@/components/WalletButton";

export default function Home() {
  const { publicKey, connected, connecting } = useWallet();
  const { connection } = useConnection();
  const [tid, setTid] = useState<number | null>(null);
  const [hasAppKey, setHasAppKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSetup, setShowSetup] = useState(false);

  const checkTid = useCallback(async () => {
    if (!publicKey) return;
    console.log("[Tribe] Checking identity for wallet:", publicKey.toBase58());
    setLoading(true);
    try {
      const walletKey = publicKey.toBase58();
      const storedTid = localStorage.getItem(STORAGE_KEYS.tid);
      const storedWallet = localStorage.getItem(STORAGE_KEYS.tidWallet);

      console.log("[Tribe] Stored TID:", storedTid, "Stored Wallet:", storedWallet);

      // Use cached TID only if it belongs to the current wallet
      if (storedTid && storedWallet === walletKey) {
        console.log("[Tribe] Using cached identity");
        setTid(parseInt(storedTid, 10));
        setHasAppKey(!!localStorage.getItem(STORAGE_KEYS.appKeySecret));
        setLoading(false);
        return;
      }

      // Clear stale cache from a different wallet
      if (storedTid && storedWallet !== walletKey) {
        console.log("[Tribe] Clearing stale identity cache");
        localStorage.removeItem(STORAGE_KEYS.tid);
        localStorage.removeItem(STORAGE_KEYS.appKeySecret);
        localStorage.removeItem(STORAGE_KEYS.tidWallet);
      }

      // Check on-chain
      console.log("[Tribe] Fetching identity from chain...");
      const onChainTid = await getTidByCustody(connection, publicKey);
      if (onChainTid !== null) {
        console.log("[Tribe] Found TID on-chain:", onChainTid);
        setTid(onChainTid);
        localStorage.setItem(STORAGE_KEYS.tid, onChainTid.toString());
        localStorage.setItem(STORAGE_KEYS.tidWallet, walletKey);
        setHasAppKey(!!localStorage.getItem(STORAGE_KEYS.appKeySecret));
      } else {
        console.log("[Tribe] No TID found for this wallet");
      }
    } catch (err) {
      console.error("[Tribe] Error checking identity:", err);
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

  // Not connected - show hero or loading
  if (!connected) {
    const hasExistingAccount = typeof window !== "undefined" && !!localStorage.getItem(STORAGE_KEYS.tid);
    
    // If we have an account, we should be connecting. If not, the WalletButton 
    // inside our Providers (via autoConnect) or a manual trigger should handle it.
    if (hasExistingAccount || connecting) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-900 border-t-transparent" />
          <h2 className="mt-6 text-xl font-bold text-gray-900">
            {connecting ? "Connecting..." : "Waking up your account..."}
          </h2>
          <p className="mt-2 text-gray-500">This usually takes less than a second.</p>
          
          {/* If it stays here for more than 5 seconds, show a manual button */}
          <div className="mt-10">
            <WalletButton className="opacity-0 hover:opacity-100 transition-opacity" label="Click if stuck" />
          </div>
        </div>
      );
    }

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
        <WalletButton className="h-11 px-8 text-base" label="Join Tribe" />
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

  // No TID - registration flow
  if (tid === null) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <RegisterIdentity onRegistered={handleRegistered} />
      </div>
    );
  }


  // Main feed view
  return (
    <div className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
      <div className="min-w-0 flex-1 max-w-2xl">
        {!hasAppKey && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <h3 className="text-sm font-bold text-blue-900">Setup Signing Key</h3>
            <p className="mt-1 text-sm text-blue-700">
              Your identity is registered, but you need a signing key to post tweets.
            </p>
            <button
              onClick={() => setShowSetup(true)}
              className="mt-3 text-xs font-bold text-blue-900 underline underline-offset-4"
            >
              Configure posting now
            </button>
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {hasAppKey ? (
            <TweetComposer tid={tid} onTweetPublished={handleTweetPublished} />
          ) : (
            <div className="p-10 text-center">
              <p className="text-gray-500">Connect your signing key to start posting.</p>
              <button 
                onClick={() => setShowSetup(true)}
                className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white"
              >
                Setup Signing Key
              </button>
            </div>
          )}
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

      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md">
            <button 
              onClick={() => setShowSetup(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              Close
            </button>
            <RegisterIdentity
              onRegistered={(newTid) => {
                handleRegistered(newTid);
                setShowSetup(false);
              }}
              initialStep="appkey"
              existingTid={tid}
            />
          </div>
        </div>
      )}
    </div>
  );
}
