import {
  BaseMessageSignerWalletAdapter,
  WalletConnectionError,
  WalletDisconnectedError,
  WalletError,
  WalletName,
  WalletNotConnectedError,
  WalletNotReadyError,
  WalletReadyState,
  WalletSignMessageError,
  WalletSignTransactionError,
} from "@solana/wallet-adapter-base";
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import { loadStoredKeypair } from "./keypair-store";

export const BROWSER_WALLET_NAME = "Browser Wallet" as WalletName<"Browser Wallet">;

/**
 * Custom event the adapter fires when a user clicks "Browser Wallet" in
 * the standard wallet modal but no keypair has been set up yet. The
 * app's top-level <BrowserWalletSetup/> listens for this and pops the
 * create/import flow.
 */
export const BROWSER_WALLET_SETUP_REQUIRED = "tribe:browser-wallet-setup-required";

/**
 * After the user completes setup, the modal dispatches this so any
 * adapter instance currently in a "connecting" state can finish.
 */
export const BROWSER_WALLET_READY = "tribe:browser-wallet-ready";

export class BrowserWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = BROWSER_WALLET_NAME;
  url = "https://github.com/chaalpritam/TribeEco";
  icon = browserWalletIcon();
  supportedTransactionVersions = new Set(["legacy" as const, 0 as const]);

  private _publicKey: PublicKey | null = null;
  private _connecting = false;
  // Always "Installed" in the browser. Unlike Phantom/Solflare we don't
  // depend on an extension being present — the keypair lives entirely
  // in this page's localStorage, so nothing to "load". Marking it
  // Installed puts it at the top of the wallet modal with a Connect
  // button (instead of a redirect to a download page) and ensures the
  // first-time setup flow runs inside connect() rather than the modal
  // opening our adapter `url` in a new tab.
  private _readyState: WalletReadyState =
    typeof window === "undefined"
      ? WalletReadyState.Unsupported
      : WalletReadyState.Installed;

  get publicKey(): PublicKey | null {
    return this._publicKey;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get readyState(): WalletReadyState {
    return this._readyState;
  }

  async connect(): Promise<void> {
    try {
      if (this.connected || this._connecting) return;
      this._connecting = true;

      const keypair = loadStoredKeypair();
      if (!keypair) {
        // Signal the app to show the setup flow. We don't render UI
        // from inside the adapter so the React tree owns the modal.
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(BROWSER_WALLET_SETUP_REQUIRED));
        }
        throw new WalletNotReadyError("Browser wallet needs setup");
      }

      this._publicKey = keypair.publicKey;
      this._keypairSecret = keypair.secretKey;
      this.emit("connect", keypair.publicKey);
    } catch (err) {
      const wrapped =
        err instanceof WalletError
          ? err
          : new WalletConnectionError((err as Error).message, err);
      this.emit("error", wrapped);
      throw wrapped;
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this._publicKey) {
      this._publicKey = null;
      this._keypairSecret = undefined;
      this.emit("disconnect");
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    tx: T,
  ): Promise<T> {
    if (!this._publicKey || !this._keypairSecret) {
      throw new WalletNotConnectedError();
    }
    try {
      if (tx instanceof VersionedTransaction) {
        tx.sign([{ publicKey: this._publicKey, secretKey: this._keypairSecret }]);
      } else {
        tx.partialSign({
          publicKey: this._publicKey,
          secretKey: this._keypairSecret,
        });
      }
      return tx;
    } catch (err) {
      throw new WalletSignTransactionError((err as Error).message, err);
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this._publicKey || !this._keypairSecret) {
      throw new WalletNotConnectedError();
    }
    try {
      return nacl.sign.detached(message, this._keypairSecret);
    } catch (err) {
      throw new WalletSignMessageError((err as Error).message, err);
    }
  }

  // Held in memory so signMessage / signTransaction don't have to
  // re-read localStorage + re-decode on every signature.
  private _keypairSecret?: Uint8Array;
}

// Suppress unused-warning helpers — reference exports so editors don't
// trim them. They're imported by callers that watch wallet errors.
export {
  WalletConnectionError,
  WalletDisconnectedError,
};

/**
 * Inline SVG used by the standard wallet modal to render the entry's
 * icon. base64-encoded so the wallet adapter library can embed it.
 */
function browserWalletIcon(): `data:image/svg+xml;base64,${string}` {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="#3b82f6" stroke="#3b82f6"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" stroke="white"/></svg>`;
  const b64 = typeof btoa === "function" ? btoa(svg) : Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}
