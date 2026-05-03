"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  BROWSER_WALLET_NAME,
  BROWSER_WALLET_READY,
  BROWSER_WALLET_SETUP_REQUIRED,
} from "@/lib/browser-wallet/adapter";
import {
  type DerivedAccount,
  deriveAccountsFromMnemonic,
  generateMnemonic,
  isValidMnemonic,
  normalizeMnemonic,
} from "@/lib/browser-wallet/mnemonic";
import { saveKeypair, saveMnemonic } from "@/lib/browser-wallet/keypair-store";

// How many accounts to derive when the user imports a phrase. We hide
// any with a zero balance, so this is the upper bound on the scan
// depth — five matches what Phantom probes initially.
const ACCOUNTS_TO_SHOW = 5;

type BalanceState = number | null | "error";

/**
 * Indexes of accounts to render in the picker. Until every balance
 * has resolved we render nothing (so accounts don't pop in/out as
 * fetches complete). After resolution we keep only funded accounts;
 * if none are funded we fall back to account 0 so the user can still
 * import a brand-new phrase.
 */
function visibleAccountIndexes(balances: BalanceState[]): number[] {
  if (!balances.every((b) => b !== null)) return [];
  const funded = balances
    .map((b, i) => (typeof b === "number" && b > 0 ? i : -1))
    .filter((i) => i !== -1);
  return funded.length > 0 ? funded : [0];
}

/**
 * Once balances have loaded, ensure the radio selection points at a
 * visible account. If the user's prior selection got filtered out,
 * snap to the first visible one.
 */
function nextSelected(balances: BalanceState[], current: number): number {
  const visible = visibleAccountIndexes(balances);
  if (visible.length === 0) return current;
  return visible.includes(current) ? current : visible[0];
}

type Step =
  | { kind: "choose" }
  | { kind: "create"; mnemonic: string; confirmed: boolean }
  | { kind: "import"; phrase: string; error: string | null }
  | {
      kind: "select";
      phrase: string;
      accounts: DerivedAccount[];
      balances: BalanceState[];
      selected: number;
    };

export default function BrowserWalletSetup() {
  const { select, connect, wallet } = useWallet();
  const { connection } = useConnection();
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
      const accounts = await deriveAccountsFromMnemonic(
        normalized,
        ACCOUNTS_TO_SHOW,
      );
      setStep({
        kind: "select",
        phrase: normalized,
        accounts,
        balances: accounts.map(() => null),
        selected: 0,
      });
      // Fire balance lookups in parallel; once they all resolve the
      // picker filters out unfunded accounts, so we re-snap `selected`
      // to a visible one if the prior pick got filtered out.
      accounts.forEach((acct, idx) => {
        const apply = (value: BalanceState) => {
          setStep((prev) => {
            if (prev.kind !== "select") return prev;
            const balances = prev.balances.slice();
            balances[idx] = value;
            return {
              ...prev,
              balances,
              selected: nextSelected(balances, prev.selected),
            };
          });
        };
        connection
          .getBalance(acct.keypair.publicKey)
          .then(apply)
          .catch(() => apply("error"));
      });
    } catch (err) {
      setStep({
        kind: "import",
        phrase: step.phrase,
        error: err instanceof Error ? err.message : "Failed to import",
      });
    } finally {
      setBusy(false);
    }
  }, [step, connection]);

  const handleSelectConfirm = useCallback(async () => {
    if (step.kind !== "select") return;
    setBusy(true);
    try {
      const account = step.accounts[step.selected];
      saveKeypair(step.phrase, account.keypair, account.index);
      await finishSetup();
    } finally {
      setBusy(false);
    }
  }, [step, finishSetup]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-bold text-gray-900">Browser wallet</h2>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-600"
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
              className="w-full rounded-lg bg-gray-900 px-4 py-3 text-left text-white transition hover:bg-gray-800"
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
                  <span className="text-gray-500">{i + 1}.</span>
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
                className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
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
              paths Phantom uses (<code>m/44&apos;/501&apos;/i&apos;/0&apos;</code>),
              so phrases from Phantom and Solflare work here. You&apos;ll
              pick which account to import on the next step.
            </p>
            <textarea
              className="h-28 w-full rounded-lg border border-gray-300 p-3 font-mono text-sm text-gray-900 outline-none focus:border-gray-900"
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
                className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                onClick={handleImport}
              >
                {busy ? "Deriving…" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step.kind === "select" && (() => {
          const allLoaded = step.balances.every((b) => b !== null);
          const visibleIdxs = visibleAccountIndexes(step.balances);
          const noFunded =
            allLoaded &&
            !step.balances.some(
              (b) => typeof b === "number" && b > 0,
            );
          return (
            <div className="space-y-4">
              {!allLoaded ? (
                <p className="text-sm text-gray-700">
                  Checking balances on Solana…
                </p>
              ) : noFunded ? (
                <p className="text-sm text-gray-700">
                  No funded accounts found on this seed. Importing
                  account #1 — fund it from another wallet to start
                  using it.
                </p>
              ) : (
                <p className="text-sm text-gray-700">
                  {visibleIdxs.length === 1
                    ? "Found one funded account on this seed."
                    : `Found ${visibleIdxs.length} funded accounts on this seed. Pick which to import.`}
                </p>
              )}

              {visibleIdxs.length > 0 && (
                <div className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200">
                  {visibleIdxs.map((i) => {
                    const acct = step.accounts[i];
                    const address = acct.keypair.publicKey.toBase58();
                    const short = `${address.slice(0, 4)}…${address.slice(-4)}`;
                    const balance = step.balances[i];
                    return (
                      <label
                        key={acct.index}
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                          step.selected === i ? "bg-gray-50" : "bg-white"
                        } hover:bg-gray-50`}
                      >
                        <input
                          type="radio"
                          name="account"
                          checked={step.selected === i}
                          onChange={() => setStep({ ...step, selected: i })}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-gray-900">
                            Account #{acct.index + 1}
                          </div>
                          <div className="font-mono text-xs text-gray-500">
                            {short}
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-700">
                          {typeof balance === "number"
                            ? `${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
                            : balance === "error"
                              ? "—"
                              : "…"}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() =>
                    setStep({
                      kind: "import",
                      phrase: step.phrase,
                      error: null,
                    })
                  }
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy || !allLoaded}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                  onClick={handleSelectConfirm}
                >
                  {busy ? "Importing…" : "Import account"}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
