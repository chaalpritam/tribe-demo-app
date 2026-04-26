# tribe-app

Next.js frontend for the Tribe protocol. Connects to Solana for on-chain identity and to the hub for off-chain social features.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home feed + tweet composer |
| `/explore` | User directory with follow buttons |
| `/channels` | Channel list + channel feeds |
| `/profile?tid=N` | User profile with tweets/followers/following tabs |
| `/tweet?hash=X` | Thread view with replies |
| `/search?q=X` | Search results |
| `/messages` | DMs (end-to-end encrypted) |
| `/notifications` | Activity feed |
| `/bookmarks` | Saved tweets |
| `/settings` | User settings + profile edit |

## How It Works

- **Wallet connection** via Solana wallet adapter (Phantom, Solflare)
- **Identity** (TID, username, app key) registered on-chain via `tribe-sdk` transaction helpers
- **Tweets** signed with ed25519 app keys, hashed with BLAKE3, submitted to the hub
- **Follows** routed through the ER server for instant confirmation (~50ms), settled to Solana L1 every 10s
- **Feed, search, profiles** read from the hub's REST API
- **Real-time updates** via WebSocket connection to the hub

## Multi-Node Failover

The frontend supports multiple hub and ER server URLs for high availability. If one node is down, requests automatically fail over to the next.

Set comma-separated URLs in environment variables:

```
NEXT_PUBLIC_HUB_URLS=https://hub-a.example.com,https://hub-b.example.com
NEXT_PUBLIC_ER_SERVER_URLS=https://er-a.example.com,https://er-b.example.com
```

For single-node / local development, use the simple form:

```
NEXT_PUBLIC_HUB_URL=http://localhost:4000
NEXT_PUBLIC_ER_SERVER_URL=http://localhost:3003
```

## Project Structure

```
src/
  app/
    page.tsx                  # Home feed
    explore/page.tsx          # User directory
    channels/page.tsx         # Channel list + feeds
    profile/page.tsx          # User profile
    tweet/page.tsx            # Thread view
    search/page.tsx           # Search results
    messages/page.tsx         # DMs
    notifications/page.tsx    # Activity
    bookmarks/page.tsx        # Saved tweets
    settings/page.tsx         # User settings
    providers.tsx             # Solana wallet provider
    layout.tsx                # Root layout
  components/
    Feed.tsx                  # Paginated feed with auto-refresh
    TweetCard.tsx             # Individual tweet display
    TweetComposer.tsx         # Tweet input + signing
    FollowButton.tsx          # Follow/unfollow via ER server
    LikeButton.tsx            # Like reaction
    RetweetButton.tsx         # Retweet
    BookmarkButton.tsx        # Bookmark toggle
    RegisterIdentity.tsx      # 3-step registration (TID, username, app key)
    Navbar.tsx                # Navigation
    ProfileSidebar.tsx        # Sidebar
  lib/
    failover.ts               # Multi-node failover fetch utility
    api.ts                    # Hub REST API client (20+ endpoints)
    er-client.ts              # ER server client (follow/unfollow)
    ws.ts                     # WebSocket subscription
    tribe.ts                  # Solana transaction helpers
    messages.ts               # Tweet signing + publishing
    constants.ts              # Environment config
    crypto.ts                 # blake3 + nacl helpers
```

## Getting Started

```bash
pnpm install
cp .env.example .env.local    # edit with your hub/ER URLs
pnpm dev                      # http://localhost:3002
```

## Tech Stack

- Next.js 16 / React 19
- TypeScript 5.x
- Tailwind CSS 4
- Solana wallet adapter (Phantom, Solflare)
- tweetnacl (ed25519 signing)
- blake3 (WASM, content-addressable hashing)

## License

MIT
