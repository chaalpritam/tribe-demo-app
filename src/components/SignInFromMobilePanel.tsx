"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import nacl from "tweetnacl";
import { useWallet } from "@solana/wallet-adapter-react";
import { STORAGE_KEYS } from "@/lib/constants";
import { BROWSER_WALLET_NAME } from "@/lib/browser-wallet/adapter";

interface PairingPayload {
  v: 1;
  kind: "tribe-pair";
  tid: string;
  appKeySeedB64: string;
  hubUrl: string;
}

function isPairingPayload(value: unknown): value is PairingPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PairingPayload>;
  return (
    v.v === 1 &&
    v.kind === "tribe-pair" &&
    typeof v.tid === "string" &&
    typeof v.appKeySeedB64 === "string" &&
    typeof v.hubUrl === "string"
  );
}

/**
 * tribe-ios encodes the *32-byte ed25519 seed* in the QR (matching
 * the way iOS stores app keys in its Keychain). tribe-app's
 * localStorage expects the full 64-byte nacl `secretKey` (seed ||
 * pubkey), which is what tweetnacl.sign.keyPair.fromSeed produces.
 * Re-expand here so the adopted account behaves identically to one
 * registered locally.
 */
function expandSeedToSecretKey(seedB64: string): string {
  const bytes = Uint8Array.from(atob(seedB64), (c) => c.charCodeAt(0));
  if (bytes.length === 64) return seedB64;
  if (bytes.length !== 32) {
    throw new Error(
      `App-key seed must be 32 or 64 bytes; got ${bytes.length}.`,
    );
  }
  const keypair = nacl.sign.keyPair.fromSeed(bytes);
  // tweetnacl's secretKey is the concatenation iOS expects.
  let binary = "";
  for (let i = 0; i < keypair.secretKey.length; i++) {
    binary += String.fromCharCode(keypair.secretKey[i]);
  }
  return btoa(binary);
}

/**
 * Inverse of MobilePairingPanel: the iOS app shows a pairing QR, this
 * panel scans it and writes the same TID + app-key into desktop
 * localStorage so the user can keep working on whichever surface is
 * in front of them. Falls back to a paste field for users on browsers
 * without camera access.
 */
export default function SignInFromMobilePanel() {
  const { wallet, disconnect } = useWallet();
  const isBrowserWallet = wallet?.adapter.name === BROWSER_WALLET_NAME;

  const [mode, setMode] = useState<"closed" | "camera" | "paste">("closed");
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const stopCamera = useCallback(() => {
    cancelledRef.current = true;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Adopt: write tid + app-key into localStorage and reload. Disconnect
  // the current wallet first so the app doesn't immediately re-sync
  // and clear the freshly-written values.
  const adopt = useCallback(
    async (payload: PairingPayload) => {
      try {
        const expanded = expandSeedToSecretKey(payload.appKeySeedB64);
        try {
          await disconnect();
        } catch {
          // best-effort; missing adapter shouldn't block restore
        }
        localStorage.setItem(STORAGE_KEYS.tid, payload.tid);
        localStorage.setItem(STORAGE_KEYS.appKeySecret, expanded);
        // Auto-select Browser Wallet so the app reconnects cleanly
        // on reload — same trick ImportBackup uses.
        localStorage.setItem("walletName", '"Browser Wallet"');
        setSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to adopt identity");
      }
    },
    [disconnect],
  );

  const handleDecoded = useCallback(
    (raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        if (!isPairingPayload(parsed)) {
          setError("QR isn't a Tribe pairing code.");
          return;
        }
        stopCamera();
        setMode("closed");
        void adopt(parsed);
      } catch {
        setError("QR contents weren't valid JSON.");
      }
    },
    [adopt, stopCamera],
  );

  // Camera loop. Pull frames into the offscreen canvas, run jsQR over
  // the imageData, fire `handleDecoded` on the first hit.
  useEffect(() => {
    if (mode !== "camera") return;
    cancelledRef.current = false;

    let teardown = () => {};

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = () => {
          if (cancelledRef.current) return;
          const canvas = canvasRef.current;
          if (canvas && video.readyState >= video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              );
              const code = jsQR(
                imageData.data,
                imageData.width,
                imageData.height,
              );
              if (code && code.data) {
                handleDecoded(code.data);
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        teardown = () => stopCamera();
      } catch (e) {
        setError(
          e instanceof Error
            ? `Camera unavailable: ${e.message}`
            : "Camera unavailable",
        );
        setMode("paste");
      }
    })();

    return () => {
      teardown();
    };
  }, [mode, handleDecoded, stopCamera]);

  // Always tear down on unmount.
  useEffect(() => () => stopCamera(), [stopCamera]);

  const handlePasteAdopt = useCallback(() => {
    setError(null);
    handleDecoded(pastedText.trim());
  }, [handleDecoded, pastedText]);

  if (!isBrowserWallet) return null;

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Sign in from mobile
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Scan a QR from tribe-ios (Settings → Sign in another device) to
            adopt the same TID + app key on this device.
          </p>
        </div>
        {mode === "closed" && (
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => {
                setError(null);
                setMode("camera");
              }}
            >
              Scan QR
            </button>
            <button
              type="button"
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => {
                setError(null);
                setMode("paste");
              }}
            >
              Paste JSON
            </button>
          </div>
        )}
      </div>

      {mode === "camera" && (
        <div className="mt-4 space-y-2">
          <div className="overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              className="aspect-video w-full"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              className="text-xs text-gray-500 underline"
              onClick={() => {
                stopCamera();
                setMode("paste");
              }}
            >
              Paste JSON instead
            </button>
            <button
              type="button"
              className="text-xs text-gray-500 underline"
              onClick={() => {
                stopCamera();
                setMode("closed");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === "paste" && (
        <div className="mt-4 space-y-2">
          <textarea
            className="h-28 w-full rounded-lg border border-gray-300 p-3 font-mono text-xs text-gray-900 outline-none focus:border-gray-900"
            placeholder='{"v":1,"kind":"tribe-pair","tid":"…","appKeySeedB64":"…","hubUrl":"…"}'
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <div className="flex justify-between gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              onClick={() => {
                setMode("closed");
                setPastedText("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!pastedText.trim()}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              onClick={handlePasteAdopt}
            >
              Adopt identity
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
          Identity adopted — reloading…
        </p>
      )}
    </div>
  );
}
