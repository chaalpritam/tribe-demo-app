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

/**
 * Canonical reference form for hub-hosted media. Stored verbatim in
 * embeds and profile fields so that a hub-IP change (DHCP renewal,
 * moving the stack to a new machine, swapping `tribe link` targets)
 * doesn't strand every image at the old address. The render side
 * resolves these against the *current* NEXT_PUBLIC_HUB_URL via
 * resolveMediaUrl.
 */
export function mediaRef(hash: string): string {
  return `media:${hash}`;
}

/**
 * Render-time helper: turn whatever was stored in an embed / pfpUrl
 * into a real URL for an <img src>. Handles three input shapes:
 *
 *   1. `media:<hash>` — the canonical form going forward
 *   2. `http(s)://…/v1/media/<hash>` — legacy absolute URL stored by
 *      pre-`mediaRef` versions of the app. We extract the hash and
 *      re-resolve so the IP burnt into the URL when the tweet was
 *      first composed gets replaced with the current hub.
 *   3. Any other URL — passed through as-is (external links etc.)
 */
export function resolveMediaUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (value.startsWith("media:")) {
    return getMediaUrl(value.slice("media:".length));
  }
  const match = value.match(/\/v1\/media\/([0-9a-fA-F]{64})/);
  if (match) return getMediaUrl(match[1]);
  return value;
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

/**
 * Channels a TID has joined (CHANNEL_JOIN messages with no later
 * matching CHANNEL_LEAVE). Used by the channels list to flip rows to
 * "Leave" and to reflect the user's joined-set everywhere it shows.
 */
export async function fetchJoinedChannels(tid: string): Promise<{ channels: { id: string }[] }> {
  const res = await hubFetch(`/v1/channels/member/${tid}`);
  if (!res.ok) return { channels: [] };
  return res.json();
}

// ── Polls ───────────────────────────────────────────────────────────

export interface PollRow {
  id: string;
  creator_tid: string;
  question: string;
  options: string[];
  expires_at: string | null;
  channel_id: string | null;
  created_at: string;
}

export async function fetchPolls(): Promise<{ polls: PollRow[] }> {
  const res = await hubFetch("/v1/polls");
  if (!res.ok) return { polls: [] };
  return res.json();
}

export async function fetchPoll(
  id: string,
): Promise<(PollRow & { tally: Record<string, number> }) | null> {
  const res = await hubFetch(`/v1/polls/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchUserPollVote(
  pollId: string,
  tid: string,
): Promise<{ option_index: number } | null> {
  const res = await hubFetch(
    `/v1/polls/${encodeURIComponent(pollId)}/vote/${tid}`,
  );
  if (!res.ok) return null;
  return res.json();
}

// ── Events ──────────────────────────────────────────────────────────

export interface EventRow {
  id: string;
  creator_tid: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  channel_id: string | null;
  image_url: string | null;
  created_at: string;
}

export async function fetchEvents(
  upcomingOnly = false,
): Promise<{ events: EventRow[] }> {
  const url = upcomingOnly ? "/v1/events?upcoming=true" : "/v1/events";
  const res = await hubFetch(url);
  if (!res.ok) return { events: [] };
  return res.json();
}

export async function fetchEvent(
  id: string,
): Promise<
  (EventRow & { rsvp_counts: Record<"yes" | "no" | "maybe", number> }) | null
> {
  const res = await hubFetch(`/v1/events/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchUserRsvp(
  eventId: string,
  tid: string,
): Promise<{ status: "yes" | "no" | "maybe" } | null> {
  const res = await hubFetch(
    `/v1/events/${encodeURIComponent(eventId)}/rsvp/${tid}`,
  );
  if (!res.ok) return null;
  return res.json();
}

// ── Tasks ───────────────────────────────────────────────────────────

export type TaskStatus = "open" | "claimed" | "completed";

export interface TaskRow {
  id: string;
  creator_tid: string;
  title: string;
  description: string | null;
  reward_text: string | null;
  channel_id: string | null;
  status: TaskStatus;
  claimed_by_tid: string | null;
  completed_by_tid: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export async function fetchTasks(
  status?: TaskStatus,
): Promise<{ tasks: TaskRow[] }> {
  const url = status ? `/v1/tasks?status=${status}` : "/v1/tasks";
  const res = await hubFetch(url);
  if (!res.ok) return { tasks: [] };
  return res.json();
}

export async function fetchTask(id: string): Promise<TaskRow | null> {
  const res = await hubFetch(`/v1/tasks/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

// ── Crowdfunds ──────────────────────────────────────────────────────

export interface CrowdfundRow {
  id: string;
  creator_tid: string;
  title: string;
  description: string | null;
  goal_amount: number;
  currency: string;
  deadline_at: string | null;
  image_url: string | null;
  channel_id: string | null;
  created_at: string;
  raised_amount: number;
  pledger_count: number;
}

export interface CrowdfundPledgeRow {
  hash: string;
  pledger_tid: string;
  amount: number;
  currency: string;
  pledged_at: string;
}

export async function fetchCrowdfunds(): Promise<{
  crowdfunds: CrowdfundRow[];
}> {
  const res = await hubFetch("/v1/crowdfunds");
  if (!res.ok) return { crowdfunds: [] };
  return res.json();
}

export async function fetchCrowdfund(id: string): Promise<CrowdfundRow | null> {
  const res = await hubFetch(`/v1/crowdfunds/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchCrowdfundPledges(
  id: string,
): Promise<{ pledges: CrowdfundPledgeRow[] }> {
  const res = await hubFetch(
    `/v1/crowdfunds/${encodeURIComponent(id)}/pledges`,
  );
  if (!res.ok) return { pledges: [] };
  return res.json();
}

// ── Karma ───────────────────────────────────────────────────────────

export interface KarmaSummary {
  tid: string;
  total: number;
  level: 1 | 2 | 3 | 4 | 5;
  breakdown: {
    tweets: number;
    reactions_received: number;
    followers: number;
    tips_received: number;
    tasks_completed: number;
  };
  weights: Record<string, number>;
}

export async function fetchKarma(tid: string): Promise<KarmaSummary | null> {
  const res = await hubFetch(`/v1/users/${tid}/karma`);
  if (!res.ok) return null;
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
 * Hub returns conversations with peer_tid + peer_username (joined from
 * the tids table) + message_count (subquery). Normalize the snake_case
 * peer_* names to other_* so the page's existing types keep working.
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
      peer_username: string | null;
      last_message_at: string | null;
      message_count: number | null;
    }>;
  };
  const conversations = (raw.conversations ?? []).map((c) => ({
    id: c.id,
    other_tid: String(c.peer_tid),
    other_username: c.peer_username ?? null,
    message_count: c.message_count ?? 0,
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
