"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { getTidByCustody } from "@/lib/tribe";
import { STORAGE_KEYS } from "@/lib/constants";
import { hasStoredKeypair } from "@/lib/browser-wallet/keypair-store";
import { BROWSER_WALLET_NAME } from "@/lib/browser-wallet/adapter";
import ProfileSidebar from "@/components/ProfileSidebar";
import TweetComposer from "@/components/TweetComposer";
import Feed from "@/components/Feed";
import RegisterIdentity from "@/components/RegisterIdentity";
import ImportBackup from "@/components/ImportBackup";
import BackupReminder from "@/components/BackupReminder";

import WalletButton from "@/components/WalletButton";

export default function Home() {
  const { publicKey, connected, connecting, select, connect, wallet } = useWallet();
  const { connection } = useConnection();
  const [tid, setTid] = useState<number | null>(null);
  const [hasAppKey, setHasAppKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const connectAttempted = useRef(false);

  // Hydrate cached session from localStorage after mount. Doing this
  // in useEffect (rather than a lazy useState initializer) avoids
  // SSR/client hydration mismatches.
  useEffect(() => {
    setMounted(true);
    const cachedTid = localStorage.getItem(STORAGE_KEYS.tid);
    if (cachedTid) setTid(parseInt(cachedTid, 10));
    setHasAppKey(!!localStorage.getItem(STORAGE_KEYS.appKeySecret));
  }, []);

  const checkTid = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const walletKey = publicKey.toBase58();
      const storedTid = localStorage.getItem(STORAGE_KEYS.tid);
      const storedWallet = localStorage.getItem(STORAGE_KEYS.tidWallet);

      if (storedTid && storedWallet === walletKey) {
        setTid(parseInt(storedTid, 10));
        setHasAppKey(!!localStorage.getItem(STORAGE_KEYS.appKeySecret));
        setLoading(false);
        return;
      }

      // Stale cache from a different wallet — clear and re-fetch.
      if (storedTid && storedWallet !== walletKey) {
        localStorage.removeItem(STORAGE_KEYS.tid);
        localStorage.removeItem(STORAGE_KEYS.appKeySecret);
        localStorage.removeItem(STORAGE_KEYS.tidWallet);
        setTid(null);
        setHasAppKey(false);
      }

      const onChainTid = await getTidByCustody(connection, publicKey);
      if (onChainTid !== null) {
        setTid(onChainTid);
        localStorage.setItem(STORAGE_KEYS.tid, onChainTid.toString());
        localStorage.setItem(STORAGE_KEYS.tidWallet, walletKey);
        setHasAppKey(!!localStorage.getItem(STORAGE_KEYS.appKeySecret));
      }
    } catch (err) {
      console.error("[Tribe] Error checking identity:", err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  // Once the wallet is connected, validate the cached identity against
  // the on-chain record (covers wallet swaps and backup restores).
  useEffect(() => {
    if (connected && publicKey) checkTid();
  }, [connected, publicKey, checkTid]);

  // Restore the wallet session in the background when we have a cached
  // account. We don't gate UI on this — the feed renders immediately
  // from the cached TID — so the user never sees a "Waking up..."
  // spinner on reload. The composer waits for `connected` before
  // enabling, since posting needs the in-memory keypair.
  const hasCachedKeypair =
    mounted &&
    !!localStorage.getItem(STORAGE_KEYS.tid) &&
    hasStoredKeypair();

  useEffect(() => {
    if (!mounted) return;
    if (connectAttempted.current) return;
    if (connected || connecting) return;
    if (!hasCachedKeypair) return;

    if (!wallet || wallet.adapter.name !== BROWSER_WALLET_NAME) {
      select(BROWSER_WALLET_NAME);
      return; // Wait for `wallet` to update, effect re-runs.
    }

    connectAttempted.current = true;
    connect().catch((err) => {
      console.warn("Background reconnect failed:", err);
      setReconnectFailed(true);
    });
  }, [mounted, connected, connecting, wallet, hasCachedKeypair, select, connect]);

  const handleTweetPublished = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleRegistered = useCallback((newTid: number) => {
    setTid(newTid);
    setHasAppKey(true);
  }, []);

  // Render nothing until the client has hydrated localStorage state.
  // This is one frame on a fast machine — avoids hydration mismatch.
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
      </div>
    );
  }

  // If connected with no TID, show registration flow as the main view.
  if (connected && tid === null && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <RegisterIdentity onRegistered={handleRegistered} />
      </div>
    );
  }

  // Unified layout: Sidebar + Main Content (Feed) + Right Sidebar
  return (
    <div className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
      <div className="min-w-0 flex-1 max-w-2xl">
        {tid === null ? (
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-900 text-2xl font-bold text-white">
              T
            </div>
            <h1 className="mt-6 text-3xl font-bold text-gray-900">
              Welcome to Tribe
            </h1>
            <p className="mt-3 text-gray-600">
              The decentralized social protocol where you own your identity.
              Connect your wallet to join the conversation.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <WalletButton className="h-11 px-8 text-base" label="Join Tribe" />
              <ImportBackup />
            </div>
          </div>
        ) : (
          <>
            <BackupReminder />
            {reconnectFailed && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-amber-900">
                  Wallet reconnect failed
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  You can keep browsing the feed, but posting is disabled.
                </p>
              </div>
            )}
            {!hasAppKey && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                <h3 className="text-sm font-bold text-blue-900">Setup Signing Key</h3>
                <button
                  onClick={() => setShowSetup(true)}
                  className="mt-2 text-xs font-bold text-blue-900 underline"
                >
                  Configure posting now
                </button>
              </div>
            )}
          </>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {tid !== null && (
            hasAppKey ? (
              <TweetComposer tid={tid} onTweetPublished={handleTweetPublished} />
            ) : (
              <div className="p-10 text-center border-b border-gray-100">
                <p className="text-gray-500">Connect your signing key to start posting.</p>
                <button
                  onClick={() => setShowSetup(true)}
                  className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white"
                >
                  Setup Signing Key
                </button>
              </div>
            )
          )}
          <Feed myTid={tid ?? undefined} refreshKey={refreshKey} />
        </div>
      </div>

      <aside className="hidden w-72 shrink-0 xl:block">
        <div className="sticky top-4">
          {tid !== null ? (
            <ProfileSidebar
              tid={tid.toString()}
              walletAddress={publicKey?.toBase58() ?? ""}
            />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="font-bold text-gray-900">New to Tribe?</h3>
              <p className="mt-2 text-sm text-gray-500">
                Tribe is a decentralized social network built on Solana.
              </p>
              <WalletButton className="mt-4 w-full" label="Get Started" />
            </div>
          )}
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
