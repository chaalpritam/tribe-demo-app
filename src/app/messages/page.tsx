"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchConversations, fetchDmMessages, getDmKey } from "@/lib/api";
import { signAndRegisterDmKey, signAndSendDm } from "@/lib/messages";
import { getDmPublicKey, encryptMessage, decryptMessage } from "@/lib/crypto";
import { STORAGE_KEYS } from "@/lib/constants";

function loadAppKey(): Uint8Array | null {
  const stored = localStorage.getItem(STORAGE_KEYS.appKeySecret);
  if (!stored) return null;
  return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
}

export default function MessagesPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      }
    >
      <MessagesPage />
    </Suspense>
  );
}

interface Conversation {
  id: string;
  other_tid: string;
  other_username: string | null;
  message_count: number;
  last_message_at: string | null;
}

interface DmMessage {
  id: string;
  sender_tid: string;
  sender_username: string | null;
  encrypted_text: string;
  nonce: string;
  created_at: string;
}

function MessagesPage() {
  const { connected } = useWallet();
  const searchParams = useSearchParams();
  const convId = searchParams.get("conv");
  const newTid = searchParams.get("to");

  const [myTid, setMyTid] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [otherPubkey, setOtherPubkey] = useState<string | null>(null);
  const [otherTid, setOtherTid] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.tid);
    if (!stored) return;
    setMyTid(stored);
    const appKey = loadAppKey();
    if (!appKey) return;
    // Register the user's x25519 DM pubkey on every load so a fresh
    // sessionStorage keypair (rotated automatically when the tab dies)
    // gets advertised to peers. Failures are non-fatal; the user can
    // still browse conversations.
    const pubkey = getDmPublicKey();
    signAndRegisterDmKey(parseInt(stored, 10), pubkey, appKey).catch((err) => {
      console.warn("DM key register failed:", err);
    });
  }, []);

  // Load conversations list
  useEffect(() => {
    if (!myTid || convId || newTid) return;
    setLoading(true);
    fetchConversations(myTid)
      .then((data) => setConversations(data?.conversations ?? []))
      .finally(() => setLoading(false));
  }, [myTid, convId, newTid]);

  // Load messages for a conversation
  useEffect(() => {
    if (!convId || !myTid) return;
    setLoading(true);
    fetchDmMessages(convId, myTid)
      .then((data) => setMessages(data?.messages ?? []))
      .finally(() => setLoading(false));
  }, [convId, myTid]);

  // Load recipient key for new conversation
  useEffect(() => {
    const tid = newTid || otherTid;
    if (!tid) return;
    getDmKey(tid).then(setOtherPubkey);
  }, [newTid, otherTid]);

  // Figure out the other TID from conversation messages
  useEffect(() => {
    if (conversations.length > 0 && convId) {
      const conv = conversations.find((c) => c.id === convId);
      if (conv) {
        setOtherTid(conv.other_tid);
      }
    }
  }, [conversations, convId]);

  const handleSend = useCallback(async () => {
    if (!myTid || !messageInput.trim() || sending) return;
    const recipientTid = newTid || otherTid;
    if (!recipientTid || !otherPubkey) return;

    const appKey = loadAppKey();
    if (!appKey) {
      setError("No app key found in this browser. Register an app key to send DMs.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const { encrypted, nonce } = encryptMessage(messageInput.trim(), otherPubkey);
      await signAndSendDm({
        senderTid: parseInt(myTid, 10),
        recipientTid: parseInt(recipientTid, 10),
        ciphertext: encrypted,
        nonce,
        senderX25519: getDmPublicKey(),
        signingKeySecret: appKey,
      });
      setMessageInput("");
      // Reload messages
      if (convId) {
        const data = await fetchDmMessages(convId, myTid);
        setMessages(data?.messages ?? []);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send DM";
      console.error("Failed to send DM:", err);
      setError(msg);
    } finally {
      setSending(false);
    }
  }, [myTid, messageInput, sending, newTid, otherTid, otherPubkey, convId]);

  if (!connected) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <p className="text-gray-500">Connect your wallet to use messages</p>
      </div>
    );
  }

  // Conversation view
  if (convId || newTid) {
    const recipientName = newTid ? `TID #${newTid}` : `TID #${otherTid}`;

    return (
      <div className="mx-auto flex max-w-2xl flex-col px-4 py-6" style={{ height: "calc(100vh - 64px)" }}>
        <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
          <Link href="/messages" className="text-gray-400 hover:text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h2 className="font-semibold text-white">{recipientName}</h2>
          {!otherPubkey && (
            <span className="text-xs text-yellow-500">No encryption key registered</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-gray-500">No messages yet. Say hi!</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isMe = msg.sender_tid === myTid;
                let text = "[encrypted]";
                if (otherPubkey) {
                  // NaCl box decryption always needs the OTHER party's public key
                  // regardless of who sent the message
                  const decrypted = decryptMessage(msg.encrypted_text, msg.nonce, otherPubkey);
                  if (decrypted) text = decrypted;
                }
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs rounded-2xl px-4 py-2 ${
                        isMe ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-200"
                      }`}
                    >
                      <p className="text-sm">{text}</p>
                      <p className="mt-1 text-xs opacity-50">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="border-t border-red-900/40 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}
        <div className="flex gap-2 border-t border-gray-800 pt-3">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={otherPubkey ? "Type a message..." : "Recipient has no DM key"}
            disabled={!otherPubkey}
            className="flex-1 rounded-full border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-600 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!messageInput.trim() || sending || !otherPubkey}
            className="rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  // Conversations list
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-white">Messages</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      ) : conversations.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">
          No conversations yet. Start one from a user's profile!
        </p>
      ) : (
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900">
          {conversations.map((conv) => {
            const name = conv.other_username
              ? `${conv.other_username}.tribe`
              : `TID #${conv.other_tid}`;
            return (
              <Link
                key={conv.id}
                href={`/messages?conv=${conv.id}`}
                className="flex items-center justify-between border-b border-gray-800 px-4 py-3 transition-colors hover:bg-gray-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600/20 text-sm font-semibold text-purple-400">
                    {conv.other_username?.[0]?.toUpperCase() ?? conv.other_tid}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{name}</p>
                    <p className="text-xs text-gray-500">
                      {conv.message_count} messages
                    </p>
                  </div>
                </div>
                {conv.last_message_at && (
                  <span className="text-xs text-gray-500">
                    {new Date(conv.last_message_at).toLocaleDateString()}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
