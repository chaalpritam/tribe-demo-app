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

export async function fetchUsers() {
  const res = await fetch(`${INDEXER_URL}/v1/users?limit=50`);
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.statusText}`);
  return res.json();
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
