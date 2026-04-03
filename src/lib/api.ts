import { TWEET_SERVER_URL, INDEXER_URL } from "./constants";

export async function fetchTweets(tid: string) {
  const res = await fetch(`${TWEET_SERVER_URL}/v1/tweetsByTid/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch tweets: ${res.statusText}`);
  return res.json();
}

export async function fetchTweet(hash: string) {
  const res = await fetch(`${TWEET_SERVER_URL}/v1/tweet?hash=${encodeURIComponent(hash)}`);
  if (!res.ok) throw new Error(`Failed to fetch tweet: ${res.statusText}`);
  return res.json();
}

export async function submitTweet(message: object) {
  const res = await fetch(`${TWEET_SERVER_URL}/v1/submitMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`Failed to submit tweet: ${res.statusText}`);
  return res.json();
}

export async function fetchUser(tid: string) {
  const res = await fetch(`${INDEXER_URL}/v1/user/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.statusText}`);
  return res.json();
}

export async function fetchFeed(tid?: string) {
  const url = tid ? `${INDEXER_URL}/v1/feed/${tid}` : `${INDEXER_URL}/v1/feed`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch feed: ${res.statusText}`);
  return res.json();
}

export async function fetchGlobalFeed() {
  const res = await fetch(`${TWEET_SERVER_URL}/v1/tweets?limit=50`);
  if (!res.ok) throw new Error(`Failed to fetch global feed: ${res.statusText}`);
  return res.json();
}

export async function uploadMedia(file: File): Promise<{ hash: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${TWEET_SERVER_URL}/v1/upload`, {
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
  return `${TWEET_SERVER_URL}/v1/media/${hash}`;
}

export async function searchTweets(query: string) {
  const res = await fetch(`${TWEET_SERVER_URL}/v1/search?q=${encodeURIComponent(query)}&limit=30`);
  if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);
  return res.json();
}

export async function fetchChannels() {
  const res = await fetch(`${TWEET_SERVER_URL}/v1/channels`);
  if (!res.ok) throw new Error(`Failed to fetch channels: ${res.statusText}`);
  return res.json();
}

export async function fetchChannelFeed(channelId: string) {
  const res = await fetch(`${TWEET_SERVER_URL}/v1/channel/${encodeURIComponent(channelId)}`);
  if (!res.ok) throw new Error(`Failed to fetch channel: ${res.statusText}`);
  return res.json();
}

export async function fetchReplies(hash: string) {
  const res = await fetch(`${TWEET_SERVER_URL}/v1/replies?hash=${encodeURIComponent(hash)}`);
  if (!res.ok) throw new Error(`Failed to fetch replies: ${res.statusText}`);
  return res.json();
}

export async function fetchUsers() {
  const res = await fetch(`${INDEXER_URL}/v1/users?limit=50`);
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
  return res.json();
}

export async function fetchNotifications(tid: string, unreadOnly = false) {
  const params = new URLSearchParams({ limit: "20" });
  if (unreadOnly) params.set("unread_only", "true");
  const res = await fetch(`${INDEXER_URL}/v1/notifications/${tid}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.statusText}`);
  return res.json();
}

export async function fetchUnreadCount(tid: string): Promise<number> {
  const res = await fetch(`${INDEXER_URL}/v1/notifications/${tid}/count`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count ?? 0;
}

export async function markNotificationsRead(tid: string, ids?: number[]) {
  await fetch(`${INDEXER_URL}/v1/notifications/${tid}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

export async function fetchFollowers(tid: string) {
  const res = await fetch(`${INDEXER_URL}/v1/followers/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch followers: ${res.statusText}`);
  return res.json();
}

export async function fetchFollowing(tid: string) {
  const res = await fetch(`${INDEXER_URL}/v1/following/${tid}`);
  if (!res.ok) throw new Error(`Failed to fetch following: ${res.statusText}`);
  return res.json();
}
