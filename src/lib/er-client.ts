import { ER_SERVER_URL } from "./constants";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Follow a user via the ER server (instant, settles to L1 in ~10s).
 */
export async function erFollow(
  followerTid: number,
  followingTid: number,
  custodyPubkey: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<{ id: string; status: string }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `tribe-er:follow:${followerTid}:${followingTid}:${timestamp}`;
  const signature = await signMessage(new TextEncoder().encode(payload));

  const res = await fetch(`${ER_SERVER_URL}/v1/follow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      followerTid: String(followerTid),
      followingTid: String(followingTid),
      custodyPubkey,
      signature: toBase64(signature),
      timestamp,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Follow failed: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Unfollow a user via the ER server.
 */
export async function erUnfollow(
  followerTid: number,
  followingTid: number,
  custodyPubkey: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<{ id: string; status: string }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `tribe-er:unfollow:${followerTid}:${followingTid}:${timestamp}`;
  const signature = await signMessage(new TextEncoder().encode(payload));

  const res = await fetch(`${ER_SERVER_URL}/v1/unfollow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      followerTid: String(followerTid),
      followingTid: String(followingTid),
      custodyPubkey,
      signature: toBase64(signature),
      timestamp,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Unfollow failed: ${res.status} ${err}`);
  }
  return res.json();
}

/**
 * Check if a follow link exists via ER server (includes pending state).
 */
export async function erGetLink(
  followerTid: number,
  followingTid: number
): Promise<{ exists: boolean; status: string }> {
  const res = await fetch(
    `${ER_SERVER_URL}/v1/link/${followerTid}/${followingTid}`
  );
  if (!res.ok) return { exists: false, status: "unknown" };
  return res.json();
}

/**
 * Get social profile via ER server (includes pending counts).
 */
export async function erGetProfile(
  tid: number
): Promise<{ tid: number; followingCount: number; followersCount: number } | null> {
  const res = await fetch(`${ER_SERVER_URL}/v1/profile/${tid}`);
  if (!res.ok) return null;
  return res.json();
}
