# tribe-app

Next.js frontend for the Tribe protocol. Connects to Solana for on-chain identity and to the hub for off-chain social features.

## Screenshots

<table>
  <tr>
    <td><img src="cover/Screenshot 2026-05-12 at 12.19.03%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.19.11%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.19.21%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.19.25%E2%80%AFPM.png" width="320"/></td>
  </tr>
  <tr>
    <td><img src="cover/Screenshot 2026-05-12 at 12.19.30%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.19.39%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.19.43%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.19.48%E2%80%AFPM.png" width="320"/></td>
  </tr>
  <tr>
    <td><img src="cover/Screenshot 2026-05-12 at 12.19.52%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.19.58%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.20.08%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.20.14%E2%80%AFPM.png" width="320"/></td>
  </tr>
  <tr>
    <td><img src="cover/Screenshot 2026-05-12 at 12.20.34%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.20.40%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.21.06%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.21.30%E2%80%AFPM.png" width="320"/></td>
  </tr>
  <tr>
    <td><img src="cover/Screenshot 2026-05-12 at 12.21.44%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.21.52%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.21.58%E2%80%AFPM.png" width="320"/></td>
    <td><img src="cover/Screenshot 2026-05-12 at 12.22.09%E2%80%AFPM.png" width="320"/></td>
  </tr>
</table>

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

The dev server binds to `0.0.0.0`, so any device on the same Wi-Fi can reach it as `http://<hostname>.local:3002` (e.g. `http://chaals-macbook-air.local:3002`). Useful for testing in iOS Safari without rebuilding.

### Cross-device development on one Wi-Fi

Run the protocol on one machine (e.g. a Mac mini) and develop the frontend from another (e.g. a MacBook Air) — no port-forwarding, no Tailscale, **and no tribe install needed on the dev laptop**. Use the LAN **IP** for the env vars (not the `*.local` hostname — Chrome's `fetch()` trips on macOS' IPv6 link-local form for `.local` names; the IPv4 has no such hazard).

```bash
# On the machine running the stack — `tribe share` prints the IP to use:
tribe start
tribe share

# On the dev laptop — just paste two env vars into .env.local:
cat > .env.local <<EOF
NEXT_PUBLIC_HUB_URL=http://192.168.1.6:4000
NEXT_PUBLIC_ER_SERVER_URL=http://192.168.1.6:3003
EOF
pnpm dev   # http://localhost:3002 — local UI, remote hub + ER
```

The Bonjour `*.local` hostname is still useful for `ping` / `curl` / iPhone Safari, just not for desktop Chrome `fetch()`. `tribe share` shows both. If you have tribe installed on the dev laptop, `tribe link http://192.168.1.6:4000` writes that same `.env.local` for you. See the [main README](../Readme.md#cross-device-development-on-one-wi-fi) for the full walkthrough + troubleshooting.

## Tech Stack

- Next.js 16 / React 19
- TypeScript 5.x
- Tailwind CSS 4
- Solana wallet adapter (Phantom, Solflare)
- tweetnacl (ed25519 signing)
- blake3 (WASM, content-addressable hashing)

## Related Repos

| Repo | Description |
|------|-------------|
| [tribe-protocol](../tribe-protocol) | Solana programs (Anchor) — 12 programs: tid-registry, app-key-registry, username-registry, social-graph w/ ER delegation, hub-registry, tip-registry, crowdfund-registry, task-registry, channel-registry, karma-registry, poll-registry, event-registry |
| [tribe-sdk](../tribe-sdk) | TypeScript SDK — DirectSolana and EphemeralRollup providers; clients for identity, tweets, DMs, profiles, channels, bookmarks, polls, events, tasks, crowdfunds, tips, search |
| [tribe-hub](../tribe-hub) | Decentralized hub — signed-message storage + Solana indexer + gossip peer sync; REST + WebSocket APIs |
| [tribe-er-server](../tribe-er-server) | Ephemeral Rollup sequencer — instant follows, batched L1 settlement every 10s |
| [tribe-app](../tribe-app) | Next.js frontend — protocol-first reference client with multi-node failover |
| [tribeapp.wtf](../tribeapp.wtf) | Consumer-facing web app + landing page at tribeapp.wtf — hyperlocal social built entirely on the protocol |
| [tribe-twitter](../tribe-twitter) | Native SwiftUI iOS client (Twitter-shaped) — full read/write against hub + ER, NaCl-box DMs, BLAKE3 + ed25519 signing via Apple CryptoKit |
| [tribe-insta](../tribe-insta) | Native SwiftUI iOS client (Instagram-shaped) — photo grid, stories, reels; same hub + envelope format as tribe-twitter. Scaffolding stage — see `tribe-insta/PLAN.md` |
| [tribe-core-swift](../tribe-core-swift) | Shared Swift package consumed by tribe-twitter + tribe-insta — crypto (BLAKE3, NaCl box, ed25519 signing, BIP39, SolanaHD), backup file format, envelope signer. See `tribe-core-swift/MIGRATION.md` |
| [homebrew-tap](../homebrew-tap) | Homebrew formulas: `brew install tribe` (hub + ER) and `brew install tribe-app` (demo UI) |
## License

MIT
