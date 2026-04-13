import { PublicKey } from "@solana/web3.js";

export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "http://localhost:4000";
export const ER_SERVER_URL = process.env.NEXT_PUBLIC_ER_SERVER_URL || "http://localhost:3003";

export const PROGRAM_IDS = {
  tidRegistry: new PublicKey("4BSmJmRGQWKgioP9DG2bUuRS9U3V6soRauU7Nv6yGvHD"),
  appKeyRegistry: new PublicKey("5LtbFUeAoXWRovGpyWnRJhiCS62XsTYKVErT9kPpv4hN"),
  usernameRegistry: new PublicKey("65oKjSjcGYR61ASzDYczbodz6H8TARtJyQGvb5V9y9W1"),
  socialGraph: new PublicKey("8kKnWvbmTjWq5uPePk79RRbQMAXCszNFzHdRwUS4N74w"),
};

export const STORAGE_KEYS = {
  appKeySecret: "tribe_app_key_secret",
  tid: "tribe_tid",
  tidWallet: "tribe_tid_wallet",
};
