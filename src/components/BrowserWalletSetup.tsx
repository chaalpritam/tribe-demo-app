"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  BROWSER_WALLET_NAME,
  BROWSER_WALLET_READY,
  BROWSER_WALLET_SETUP_REQUIRED,
} from "@/lib/browser-wallet/adapter";
import {
  generateMnemonic,
  isValidMnemonic,
  normalizeMnemonic,
} from "@/lib/browser-wallet/mnemonic";
import { saveMnemonic } from "@/lib/browser-wallet/keypair-store";

type Step =
  | { kind: "choose" }
  | { kind: "create"; mnemonic: string; confirmed: boolean }
  | { kind: "import"; phrase: string; error: string | null };

export default function BrowserWalletSetup() {
  const { select, connect, wallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [busy, setBusy] = useState(false);

  // Open the modal when the adapter requests setup. The adapter
  // dispatches this DOM event from connect() when no keypair exists.
  useEffect(() => {
    const handler = () => {
      setStep({ kind: "choose" });
      setOpen(true);
    };
    window.addEventListener(BROWSER_WALLET_SETUP_REQUIRED, handler);
    return () => window.removeEventListener(BROWSER_WALLET_SETUP_REQUIRED, handler);
  }, []);

  const finishSetup = useCallback(async () => {
    setOpen(false);
    setStep({ kind: "choose" });
    window.dispatchEvent(new Event(BROWSER_WALLET_READY));

    // Make sure Browser Wallet is the selected adapter, then trigger
    // a fresh connect now that the keypair exists. Without this, the
    // user would have to click "Connect Wallet" a second time.
    if (wallet?.adapter.name !== BROWSER_WALLET_NAME) {
      select(BROWSER_WALLET_NAME);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    try {
      await connect();
    } catch (err) {
      console.warn("Browser wallet connect after setup failed:", err);
    }
  }, [select, connect, wallet]);

  const handleCreate = useCallback(async () => {
    if (step.kind !== "create" || !step.confirmed) return;
    setBusy(true);
    try {
      await saveMnemonic(step.mnemonic);
      await finishSetup();
    } finally {
      setBusy(false);
    }
  }, [step, finishSetup]);

  const handleImport = useCallback(async () => {
    if (step.kind !== "import") return;
    const normalized = normalizeMnemonic(step.phrase);
    if (!isValidMnemonic(normalized)) {
      setStep({
        kind: "import",
        phrase: step.phrase,
        error: "That doesn't look like a valid 12 or 24 word BIP39 phrase.",
      });
      return;
    }
    setBusy(true);
    try {
      await saveMnemonic(normalized);
      await finishSetup();
    } catch (err) {
      setStep({
        kind: "import",
        phrase: step.phrase,
        error: err instanceof Error ? err.message : "Failed to import",
      });
    } finally {
      setBusy(false);
    }
  }, [step, finishSetup]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold text-gray-900">Browser wallet</h2>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900">
          <strong>Dev/demo only.</strong> Keys are stored unencrypted in this
          browser&apos;s localStorage. Anyone with access to this profile can
          read them. Do not put real funds here — use Phantom or a hardware
          wallet for that.
        </div>

        {step.kind === "choose" && (
          <div className="space-y-3">
            <button
              type="button"
              className="w-full rounded-lg bg-blue-500 px-4 py-3 text-left text-white transition hover:bg-blue-600"
              onClick={() =>
                setStep({
                  kind: "create",
                  mnemonic: generateMnemonic(24),
                  confirmed: false,
                })
              }
            >
              <div className="font-semibold">Create new wallet</div>
              <div className="text-sm text-blue-100">
                Generate a fresh 24-word seed phrase
              </div>
            </button>

            <button
              type="button"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-left text-gray-900 transition hover:bg-gray-50"
              onClick={() => setStep({ kind: "import", phrase: "", error: null })}
            >
              <div className="font-semibold">Import existing wallet</div>
              <div className="text-sm text-gray-600">
                Paste a 12 or 24 word seed phrase from Phantom, Solflare, etc.
              </div>
            </button>
          </div>
        )}

        {step.kind === "create" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Write these 24 words down in order. They are the only way to
              recover this wallet.
            </p>
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 font-mono text-sm">
              {step.mnemonic.split(" ").map((word, i) => (
                <div key={i} className="flex gap-1">
                  <span className="text-gray-400">{i + 1}.</span>
                  <span className="text-gray-900">{word}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="text-xs text-blue-600 underline"
              onClick={() => navigator.clipboard.writeText(step.mnemonic)}
            >
              Copy phrase
            </button>
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={step.confirmed}
                onChange={(e) =>
                  setStep({ ...step, confirmed: e.target.checked })
                }
              />
              <span>
                I&apos;ve written down the seed phrase somewhere safe. I
                understand losing it means losing access to this wallet.
              </span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setStep({ kind: "choose" })}
              >
                Back
              </button>
              <button
                type="button"
                disabled={!step.confirmed || busy}
                className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                onClick={handleCreate}
              >
                {busy ? "Creating…" : "Create wallet"}
              </button>
            </div>
          </div>
        )}

        {step.kind === "import" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Paste your 12 or 24 word BIP39 seed phrase. Same derivation
              path Phantom uses (<code>m/44&apos;/501&apos;/0&apos;/0&apos;</code>),
              so phrases from Phantom and Solflare work here.
            </p>
            <textarea
              className="h-28 w-full rounded-lg border border-gray-300 p-3 font-mono text-sm text-gray-900 outline-none focus:border-blue-500"
              placeholder="word1 word2 word3 …"
              value={step.phrase}
              onChange={(e) =>
                setStep({ kind: "import", phrase: e.target.value, error: null })
              }
            />
            {step.error && (
              <p className="text-xs text-red-600">{step.error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setStep({ kind: "choose" })}
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy || step.phrase.trim().length === 0}
                className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
                onClick={handleImport}
              >
                {busy ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
