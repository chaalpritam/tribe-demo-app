import { HUB_URL } from "./constants";

export async function fetchTweets(tid: string) {
  const res = await fetch(`${HUB_URL}/v1/feed/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch tweets: ${res.statusText}`);
  return res.json();
}

export async function fetchTweet(hash: string) {
  const res = await fetch(`${HUB_URL}/v1/messages/${encodeURIComponent(hash)}`);
  if (!res.ok) throw new Error(`Failed to fetch tweet: ${res.statusText}`);
  return res.json();
}

export async function submitTweet(message: object) {
  const res = await fetch(`${HUB_URL}/v1/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`Failed to submit tweet: ${res.statusText}`);
  return res.json();
}

export async function fetchUser(tid: string) {
  const res = await fetch(`${HUB_URL}/v1/user/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.statusText}`);
  return res.json();
}

export async function fetchFeed(tid?: string) {
  const url = tid ? `${HUB_URL}/v1/feed/${tid}` : `${HUB_URL}/v1/feed`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch feed: ${res.statusText}`);
  return res.json();
}

export async function fetchGlobalFeed() {
  const res = await fetch(`${HUB_URL}/v1/feed?limit=50`);
  if (!res.ok) throw new Error(`Failed to fetch global feed: ${res.statusText}`);
  return res.json();
}

export async function uploadMedia(file: File): Promise<{ hash: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${HUB_URL}/v1/upload`, {
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
  return `${HUB_URL}/v1/media/${hash}`;
}

export async function searchTweets(query: string) {
  const res = await fetch(`${HUB_URL}/v1/search?q=${encodeURIComponent(query)}&limit=30`);
  if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
  return res.json();
}

export async function fetchChannels() {
  const res = await fetch(`${HUB_URL}/v1/channels`);
  if (!res.ok) throw new Error(`Failed to fetch channels: ${res.statusText}`);
  return res.json();
}

export async function fetchChannelFeed(channelId: string) {
  const res = await fetch(`${HUB_URL}/v1/feed/channel/${encodeURIComponent(channelId)}`);
  if (!res.ok) throw new Error(`Failed to fetch channel: ${res.statusText}`);
  return res.json();
}

export async function fetchReplies(hash: string) {
  const res = await fetch(`${HUB_URL}/v1/replies?hash=${encodeURIComponent(hash)}`);
  if (!res.ok) throw new Error(`Failed to fetch replies: ${res.statusText}`);
  return res.json();
}

export async function fetchUsers() {
  const res = await fetch(`${HUB_URL}/v1/users?limit=50`);
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
  return res.json();
}

export async function fetchNotifications(tid: string, unreadOnly = false) {
  const params = new URLSearchParams({ limit: "20" });
  if (unreadOnly) params.set("unread_only", "true");
  const res = await fetch(`${HUB_URL}/v1/notifications/${tid}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.statusText}`);
  return res.json();
}

export async function fetchUnreadCount(tid: string): Promise<number> {
  const res = await fetch(`${HUB_URL}/v1/notifications/${tid}/count`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count ?? 0;
}

export async function markNotificationsRead(tid: string, ids?: number[]) {
  await fetch(`${HUB_URL}/v1/notifications/${tid}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

export async function fetchBookmarks(tid: string) {
  const res = await fetch(`${HUB_URL}/v1/bookmarks/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch bookmarks: ${res.statusText}`);
  return res.json();
}

export async function fetchFollowers(tid: string) {
  const res = await fetch(`${HUB_URL}/v1/followers/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch followers: ${res.statusText}`);
  return res.json();
}

export async function registerDmKey(tid: string, x25519Pubkey: string) {
  await fetch(`${HUB_URL}/v1/dm/register-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tid, x25519Pubkey }),
  });
}

export async function getDmKey(tid: string): Promise<string | null> {
  const res = await fetch(`${HUB_URL}/v1/dm/key/${tid}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.x25519Pubkey ?? null;
}

export async function sendDm(senderTid: string, recipientTid: string, encryptedText: string, nonce: string) {
  const res = await fetch(`${HUB_URL}/v1/dm/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senderTid, recipientTid, encryptedText, nonce }),
  });
  if (!res.ok) throw new Error("Failed to send DM");
  return res.json();
}

export async function fetchConversations(tid: string) {
  const res = await fetch(`${HUB_URL}/v1/dm/conversations/${tid}`);
  if (!res.ok) return { conversations: [] };
  return res.json();
}

export async function fetchDmMessages(conversationId: string) {
  const res = await fetch(`${HUB_URL}/v1/dm/messages/${conversationId}`);
  if (!res.ok) return { messages: [] };
  return res.json();
}

export async function fetchFollowing(tid: string) {
  const res = await fetch(`${HUB_URL}/v1/following/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch following: ${res.statusText}`);
  return res.json();
}
