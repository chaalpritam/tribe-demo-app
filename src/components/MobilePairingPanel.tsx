"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import QRCode from "qrcode";
import { HUB_URL, STORAGE_KEYS } from "@/lib/constants";
import { BROWSER_WALLET_NAME } from "@/lib/browser-wallet/adapter";

interface PairingPayload {
  v: 1;
  kind: "tribe-pair";
  tid: string;
  appKeySeedB64: string;
  hubUrl: string;
}

const LAN_PLACEHOLDER = "YOUR-LAN-IP";

// localhost works for the desktop but not for a phone on the same Wi-Fi —
// surface a placeholder the user has to fill in so a stale localhost
// URL never makes it into the QR.
function defaultMobileHubUrl(): string {
  try {
    const u = new URL(HUB_URL);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return `${u.protocol}//${LAN_PLACEHOLDER}:${u.port || "4000"}`;
    }
    return HUB_URL;
  } catch {
    return HUB_URL;
  }
}

// localStorage is an external system — useSyncExternalStore is the
// React 19 / Next 16 way to read it without tripping the
// set-state-in-effect rule.
function useLocalStorageValue(key: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      const handler = (e: StorageEvent) => {
        if (e.key === key) cb();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    () => (typeof window === "undefined" ? null : window.localStorage.getItem(key)),
    () => null,
  );
}

export default function MobilePairingPanel() {
  const { wallet } = useWallet();
  const isBrowserWallet = wallet?.adapter.name === BROWSER_WALLET_NAME;

  const tid = useLocalStorageValue(STORAGE_KEYS.tid);
  const appKeyB64 = useLocalStorageValue(STORAGE_KEYS.appKeySecret);

  const [mobileHubUrl, setMobileHubUrl] = useState(defaultMobileHubUrl());
  const [revealed, setRevealed] = useState(false);
  // Cached QR keyed by the JSON it encodes. Lets us derive
  // "is the current QR fresh?" during render instead of clearing
  // qrDataUrl from inside an effect (which the lint blocks).
  const [qrCache, setQrCache] = useState<{ key: string; dataUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payload: PairingPayload | null = useMemo(() => {
    if (!tid || !appKeyB64) return null;
    if (!mobileHubUrl || mobileHubUrl.includes(LAN_PLACEHOLDER)) return null;
    return {
      v: 1,
      kind: "tribe-pair",
      tid,
      appKeySeedB64: appKeyB64,
      hubUrl: mobileHubUrl.trim(),
    };
  }, [tid, appKeyB64, mobileHubUrl]);

  const payloadJson = payload ? JSON.stringify(payload) : null;

  useEffect(() => {
    if (!revealed || !payloadJson) return;
    let cancelled = false;
    QRCode.toDataURL(payloadJson, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    })
      .then((url) => {
        if (cancelled) return;
        setQrCache({ key: payloadJson, dataUrl: url });
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to render QR");
      });
    return () => {
      cancelled = true;
    };
  }, [revealed, payloadJson]);

  if (!isBrowserWallet) return null;

  const hasIdentity = Boolean(tid && appKeyB64);
  const hubUrlReady = Boolean(payload);
  // Only render the cached QR if it matches the current payload —
  // otherwise we'd briefly show stale bytes after the URL changes.
  const liveQrDataUrl =
    revealed && payloadJson && qrCache?.key === payloadJson ? qrCache.dataUrl : null;

  return (
    <div className="mt-10 rounded-lg border border-gray-200 bg-gray-100 p-4">
      <h2 className="text-lg font-semibold text-gray-900">Log in on mobile</h2>
      <p className="mt-1 text-sm text-gray-500">
        Scan this QR from the Tribe iOS app to sign into the same account.
        The QR contains your app key — anyone with a photo of it can sign as
        you, so don&apos;t share your screen.
      </p>

      {!hasIdentity ? (
        <p className="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
          Register an identity on this account first, then come back here to
          pair.
        </p>
      ) : (
        <>
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Mobile hub URL
          </label>
          <input
            type="text"
            value={mobileHubUrl}
            onChange={(e) => setMobileHubUrl(e.target.value)}
            placeholder="http://192.168.1.5:4000"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 outline-none focus:border-gray-900"
          />
          <p className="mt-1 text-xs text-gray-500">
            The phone needs a hub URL it can reach. On the same Wi-Fi as this
            machine, use this device&apos;s LAN IP (e.g.{" "}
            <code className="rounded bg-white px-1 py-0.5">
              http://192.168.1.5:4000
            </code>
            ). For a deployed seed node, use its public URL.
          </p>

          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              disabled={!hubUrlReady}
              className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              Show QR
            </button>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-3">
              {liveQrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={liveQrDataUrl}
                  alt="Pairing QR"
                  className="h-72 w-72 rounded-lg bg-white p-2"
                />
              ) : (
                <div className="flex h-72 w-72 items-center justify-center rounded-lg bg-white">
                  <p className="px-4 text-center text-sm text-gray-500">
                    {error ?? "Generating…"}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setRevealed(false)}
                className="text-sm text-gray-500 underline"
              >
                Hide QR
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
