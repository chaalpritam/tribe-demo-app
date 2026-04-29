"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  fetchConversations,
  fetchDmMessages,
  getDmKey,
  fetchUserGroups,
  fetchGroup,
  fetchGroupMessages,
  type DmGroupRow,
  type DmGroupMessage,
} from "@/lib/api";
import {
  signAndRegisterDmKey,
  signAndSendDm,
  signAndCreateGroup,
  signAndSendGroupMessage,
} from "@/lib/messages";
import { getDmPublicKey, encryptMessage, decryptMessage } from "@/lib/crypto";
import { STORAGE_KEYS } from "@/lib/constants";

const GROUP_ID_RE = /^[a-z0-9-]{1,64}$/;

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
  const groupId = searchParams.get("group");

  const [myTid, setMyTid] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<DmGroupRow[]>([]);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [otherPubkey, setOtherPubkey] = useState<string | null>(null);
  const [otherTid, setOtherTid] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

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

  // Load conversations + groups list
  useEffect(() => {
    if (!myTid || convId || newTid || groupId) return;
    setLoading(true);
    Promise.all([fetchConversations(myTid), fetchUserGroups(myTid)])
      .then(([convData, groupData]) => {
        setConversations(convData?.conversations ?? []);
        setGroups(groupData?.groups ?? []);
      })
      .finally(() => setLoading(false));
  }, [myTid, convId, newTid, groupId]);

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

  // Group conversation view — separate flow because the wire format
  // differs from 1:1 (per-recipient ciphertexts) and the recipient
  // set is N peers instead of one.
  if (groupId && myTid) {
    return <GroupConversationView groupId={groupId} myTid={myTid} />;
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        {myTid && (
          <button
            onClick={() => setShowCreateGroup(true)}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            + Group
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
        </div>
      ) : conversations.length === 0 && groups.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">
          No conversations yet. Start one from a user&apos;s profile, or
          create a group with <span className="text-purple-400">+ Group</span>.
        </p>
      ) : (
        <>
          {groups.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Groups
              </p>
              <div className="rounded-xl border border-gray-800 bg-gray-900">
                {groups.map((g) => (
                  <Link
                    key={g.id}
                    href={`/messages?group=${encodeURIComponent(g.id)}`}
                    className="flex items-center justify-between border-b border-gray-800 px-4 py-3 transition-colors hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600/20 text-sm font-semibold text-green-400">
                        {g.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{g.name}</p>
                        <p className="text-xs text-gray-500">
                          {g.member_count} {g.member_count === 1 ? "member" : "members"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">#{g.id}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {conversations.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Direct messages
              </p>
              <div className="rounded-xl border border-gray-800 bg-gray-900">
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
            </div>
          )}
        </>
      )}

      {showCreateGroup && myTid && (
        <CreateGroupModal
          myTid={myTid}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(id) => {
            setShowCreateGroup(false);
            window.location.href = `/messages?group=${encodeURIComponent(id)}`;
          }}
        />
      )}
    </div>
  );
}

// ── Group conversation view + create modal ──────────────────────────

interface GroupConversationViewProps {
  groupId: string;
  myTid: string;
}

function GroupConversationView({ groupId, myTid }: GroupConversationViewProps) {
  const [group, setGroup] = useState<{
    id: string;
    name: string;
    members: { tid: string; joined_at: string }[];
  } | null>(null);
  const [memberKeys, setMemberKeys] = useState<Map<string, string>>(new Map());
  const [messages, setMessages] = useState<DmGroupMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch group + members + every member's x25519 pubkey + messages.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const g = await fetchGroup(groupId);
      if (cancelled || !g) {
        setLoading(false);
        return;
      }
      setGroup(g);
      // Look up each member's DM pubkey in parallel. Members without
      // a registered key are skipped at send time (with a warning).
      const pairs = await Promise.all(
        g.members.map(async (m) => [m.tid, await getDmKey(m.tid)] as const),
      );
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const [tid, key] of pairs) if (key) map.set(tid, key);
      setMemberKeys(map);

      const msgs = await fetchGroupMessages(groupId, myTid);
      if (cancelled) return;
      setMessages(msgs.messages);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, myTid]);

  const handleSend = useCallback(async () => {
    if (!group || !text.trim() || sending) return;
    const appKey = loadAppKey();
    if (!appKey) {
      setError("No app key — register your identity first");
      return;
    }
    setSending(true);
    setError(null);
    try {
      // Encrypt the same plaintext once per member, including the
      // sender, so the sender's own UI can decrypt their own message
      // on read (the hub's per-recipient join only returns rows
      // where recipient_tid = caller).
      const ciphertexts: {
        recipient_tid: number;
        ciphertext: string;
        nonce: string;
      }[] = [];
      for (const m of group.members) {
        const pubkey = memberKeys.get(m.tid);
        if (!pubkey) continue;
        const { encrypted, nonce } = encryptMessage(text.trim(), pubkey);
        ciphertexts.push({
          recipient_tid: parseInt(m.tid, 10),
          ciphertext: encrypted,
          nonce,
        });
      }
      if (ciphertexts.length === 0) {
        setError("No members have registered DM keys yet");
        setSending(false);
        return;
      }
      await signAndSendGroupMessage({
        tid: parseInt(myTid, 10),
        groupId: group.id,
        senderX25519: getDmPublicKey(),
        ciphertexts,
        signingKeySecret: appKey,
      });
      setText("");
      const refreshed = await fetchGroupMessages(group.id, myTid);
      setMessages(refreshed.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }, [group, text, sending, memberKeys, myTid]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col px-4 py-6" style={{ height: "calc(100vh - 64px)" }}>
      <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
        <Link href="/messages" className="text-gray-400 hover:text-white">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-white">{group?.name ?? "Group"}</h2>
          {group && (
            <p className="text-xs text-gray-500">
              {group.members.length} members ·{" "}
              {memberKeys.size}/{group.members.length} have DM keys
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-500">No messages yet.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMe = msg.sender_tid === myTid;
              const decrypted = decryptMessage(
                msg.ciphertext,
                msg.nonce,
                msg.sender_x25519,
              );
              const text = decrypted ?? "[encrypted]";
              return (
                <div key={msg.hash} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-xs rounded-2xl px-4 py-2 ${
                      isMe ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-200"
                    }`}
                  >
                    {!isMe && (
                      <p className="mb-0.5 text-[10px] uppercase opacity-60">
                        TID #{msg.sender_tid}
                      </p>
                    )}
                    <p className="text-sm">{text}</p>
                    <p className="mt-1 text-xs opacity-50">
                      {new Date(msg.timestamp).toLocaleTimeString()}
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          disabled={memberKeys.size === 0}
          className="flex-1 rounded-full border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-600 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending || memberKeys.size === 0}
          className="rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

interface CreateGroupModalProps {
  myTid: string;
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

function CreateGroupModal({ myTid, onClose, onCreated }: CreateGroupModalProps) {
  const [name, setName] = useState("");
  // Comma-separated TIDs the user wants to add (besides themselves).
  const [memberInput, setMemberInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    const otherTids = memberInput
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (otherTids.length === 0) {
      setError("Add at least one other member's TID (comma-separated)");
      return;
    }
    const appKey = loadAppKey();
    if (!appKey) {
      setError("No app key — register your identity first");
      return;
    }
    const slug = `g-${Math.random().toString(36).slice(2, 10)}-${Date.now()
      .toString(36)
      .slice(-4)}`;
    if (!GROUP_ID_RE.test(slug)) {
      setError("Could not generate a valid group id");
      return;
    }
    setSubmitting(true);
    try {
      const myTidNum = parseInt(myTid, 10);
      // Hub requires >=2 members; include the creator so a 1-other-member
      // group still satisfies the constraint.
      const memberTids = Array.from(new Set([myTidNum, ...otherTids]));
      await signAndCreateGroup({
        tid: myTidNum,
        groupId: slug,
        name: name.trim(),
        memberTids,
        signingKeySecret: appKey,
      });
      onCreated(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  }, [name, memberInput, myTid, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New group</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400">Group name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Trip planning"
              maxLength={80}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400">
              Member TIDs <span className="text-gray-600">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              placeholder="42, 87, 12"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white outline-none focus:border-purple-600"
            />
            <p className="mt-1 text-xs text-gray-500">
              You&apos;ll be added automatically. Each member needs a registered DM
              key to receive encrypted messages.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create group"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
