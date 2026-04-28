import { hubFetch, getHubBaseUrl } from "./failover";

export async function fetchTweets(tid: string) {
  const res = await hubFetch(`/v1/feed/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch tweets: ${res.statusText}`);
  return res.json();
}

export async function fetchTweet(hash: string) {
  const res = await hubFetch(`/v1/messages/${encodeURIComponent(hash)}`);
  if (!res.ok) throw new Error(`Failed to fetch tweet: ${res.statusText}`);
  return res.json();
}

export async function submitTweet(message: object) {
  const res = await hubFetch("/v1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`Failed to submit tweet: ${res.statusText}`);
  return res.json();
}

export async function fetchUser(tid: string) {
  const res = await hubFetch(`/v1/user/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.statusText}`);
  return res.json();
}

export async function fetchFeed(tid?: string) {
  const path = tid ? `/v1/feed/${tid}` : "/v1/feed";
  const res = await hubFetch(path);
  if (!res.ok) throw new Error(`Failed to fetch feed: ${res.statusText}`);
  return res.json();
}

export async function fetchGlobalFeed() {
  const res = await hubFetch("/v1/feed?limit=50");
  if (!res.ok) throw new Error(`Failed to fetch global feed: ${res.statusText}`);
  return res.json();
}

export async function uploadMedia(file: File): Promise<{ hash: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await hubFetch("/v1/upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${res.status} ${err}`);
  }
  return res.json();
}

export function getMediaUrl(hash: string): string {
  return `${getHubBaseUrl()}/v1/media/${hash}`;
}

export async function searchTweets(query: string) {
  const res = await hubFetch(`/v1/search?q=${encodeURIComponent(query)}&limit=30`);
  if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
  return res.json();
}

export async function fetchChannels() {
  const res = await hubFetch("/v1/channels");
  if (!res.ok) throw new Error(`Failed to fetch channels: ${res.statusText}`);
  return res.json();
}

export async function fetchChannelFeed(channelId: string) {
  const res = await hubFetch(`/v1/feed/channel/${encodeURIComponent(channelId)}`);
  if (!res.ok) throw new Error(`Failed to fetch channel: ${res.statusText}`);
  return res.json();
}

export async function fetchReplies(hash: string) {
  const res = await hubFetch(`/v1/replies?hash=${encodeURIComponent(hash)}`);
  if (!res.ok) throw new Error(`Failed to fetch replies: ${res.statusText}`);
  return res.json();
}

export async function fetchUsers() {
  const res = await hubFetch("/v1/users?limit=50");
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
  return res.json();
}

export async function fetchNotifications(tid: string, unreadOnly = false) {
  const params = new URLSearchParams({ limit: "20" });
  if (unreadOnly) params.set("unread_only", "true");
  const res = await hubFetch(`/v1/notifications/${tid}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.statusText}`);
  return res.json();
}

export async function fetchUnreadCount(tid: string): Promise<number> {
  const res = await hubFetch(`/v1/notifications/${tid}/count`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count ?? 0;
}

export async function markNotificationsRead(tid: string, ids?: number[]) {
  await hubFetch(`/v1/notifications/${tid}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

export async function fetchBookmarks(tid: string) {
  const res = await hubFetch(`/v1/bookmarks/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch bookmarks: ${res.statusText}`);
  return res.json();
}

export async function fetchFollowers(tid: string) {
  const res = await hubFetch(`/v1/followers/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch followers: ${res.statusText}`);
  return res.json();
}

/**
 * Look up another TID's registered x25519 public key so we can encrypt
 * to them. Hub returns the field as `x25519_pubkey` (snake_case);
 * normalize to a flat string here.
 */
export async function getDmKey(tid: string): Promise<string | null> {
  const res = await hubFetch(`/v1/dm/key/${tid}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.x25519_pubkey ?? data.x25519Pubkey ?? null;
}

interface ConversationRow {
  id: string;
  other_tid: string;
  other_username: string | null;
  message_count: number;
  last_message_at: string | null;
}

/**
 * Hub returns `{ conversations: [{ id, peer_tid, last_message_at }] }`.
 * Normalize peer_tid → other_tid so the UI's existing types keep
 * working. message_count + other_username aren't on the hub response;
 * the page renders defaults for them.
 */
export async function fetchConversations(
  tid: string,
): Promise<{ conversations: ConversationRow[] }> {
  const res = await hubFetch(`/v1/dm/conversations/${tid}`);
  if (!res.ok) return { conversations: [] };
  const raw = (await res.json()) as {
    conversations?: Array<{
      id: string;
      peer_tid: number | string;
      last_message_at: string | null;
    }>;
  };
  const conversations = (raw.conversations ?? []).map((c) => ({
    id: c.id,
    other_tid: String(c.peer_tid),
    other_username: null,
    message_count: 0,
    last_message_at: c.last_message_at,
  }));
  return { conversations };
}

interface DmMessageRow {
  id: string;
  sender_tid: string;
  sender_username: string | null;
  encrypted_text: string;
  nonce: string;
  created_at: string;
}

/**
 * Hub requires a `?tid=` query param so it can verify the caller is a
 * conversation participant before returning messages. Normalize the
 * hub's row shape (ciphertext, timestamp) to what the UI expects
 * (encrypted_text, created_at) so the messages page doesn't drift
 * between repos.
 */
export async function fetchDmMessages(
  conversationId: string,
  tid: string,
): Promise<{ messages: DmMessageRow[] }> {
  const res = await hubFetch(
    `/v1/dm/messages/${conversationId}?tid=${encodeURIComponent(tid)}`,
  );
  if (!res.ok) return { messages: [] };
  const raw = (await res.json()) as {
    messages?: Array<{
      hash: string;
      sender_tid: number | string;
      ciphertext: string;
      nonce: string;
      timestamp: string;
    }>;
  };
  const messages = (raw.messages ?? []).map((m) => ({
    id: m.hash,
    sender_tid: String(m.sender_tid),
    sender_username: null,
    encrypted_text: m.ciphertext,
    nonce: m.nonce,
    created_at: m.timestamp,
  }));
  return { messages };
}

export async function fetchFollowing(tid: string) {
  const res = await hubFetch(`/v1/following/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch following: ${res.statusText}`);
  return res.json();
}
