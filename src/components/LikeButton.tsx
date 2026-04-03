"use client";

import { useState, useCallback } from "react";
import { STORAGE_KEYS, TWEET_SERVER_URL } from "@/lib/constants";

interface LikeButtonProps {
  tweetHash: string;
  tid: number;
  initialCount?: number;
}

async function blake3Hash(data: Uint8Array): Promise<Uint8Array> {
  try {
    const blake3 = await import("blake3/browser");
    const result = blake3.hash(data);
    if (result instanceof Uint8Array) return result;
    return new Uint8Array(result);
  } catch {
    const hashBuf = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(data) as unknown as BufferSource
    );
    return new Uint8Array(hashBuf);
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function LikeButton({
  tweetHash,
  tid,
  initialCount = 0,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  const handleLike = useCallback(async () => {
    if (liked || loading) return;
    setLoading(true);

    try {
      const secretKeyB64 = localStorage.getItem(STORAGE_KEYS.appKeySecret);
      if (!secretKeyB64) return;

      const nacl = (await import("tweetnacl")).default;
      const secretKey = Uint8Array.from(atob(secretKeyB64), (c) =>
        c.charCodeAt(0)
      );
      const keyPair = nacl.sign.keyPair.fromSecretKey(secretKey);

      const data = {
        type: 3, // REACTION_ADD
        tid,
        timestamp: Math.floor(Date.now() / 1000),
        network: 2,
        body: {
          type: 1, // LIKE
          target_hash: tweetHash,
        },
      };

      const dataBytes = new TextEncoder().encode(JSON.stringify(data));
      const hashBytes = await blake3Hash(dataBytes);
      const signature = nacl.sign.detached(hashBytes, secretKey);

      const message = {
        protocolVersion: 1,
        data,
        hash: toBase64(hashBytes),
        signature: toBase64(signature),
        signer: toBase64(keyPair.publicKey),
      };

      const res = await fetch(`${TWEET_SERVER_URL}/v1/submitMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });

      if (res.ok) {
        setLiked(true);
        setCount((c) => c + 1);
      }
    } catch (err) {
      console.error("Like error:", err);
    } finally {
      setLoading(false);
    }
  }, [liked, loading, tweetHash, tid]);

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      className={`flex items-center gap-1 text-sm transition-colors ${
        liked
          ? "text-pink-500"
          : "text-gray-500 hover:text-pink-400"
      }`}
    >
      <svg
        className="h-4 w-4"
        fill={liked ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={liked ? 0 : 1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
