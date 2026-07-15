**Language:** **English** · [中文](README.zh-CN.md)

# Archive of Fate · 命运档案馆

> An AI-driven text life-simulation game with on-chain fate inscription (BNB Smart Chain).
> Be born into a random world → draw talents → allocate attributes → live through random events year by year → get an AI life summary → mint that fate as an NFT, permanently on-chain.

Every run is a full life. You're born into one of three worlds — **Modern / Cultivation / Fantasy** — shape your character with a limited pool of attribute points, and watch random fate carry them through decades to the end. You finish with a one-line AI-written life summary and a fate level. If you like it, connect a wallet and **inscribe** that life as an on-chain NFT — it joins the global **Fate Archive** board, where anyone can view it and **verify it on-chain**.

---

## ✨ Features

| Feature | What it does |
|---|---|
| **Text life simulation** | Deterministic rules engine advances year by year: events, talents, attributes (Charm/Intellect/Strength/Wealth/Spirit), mythic moments, fate level (D→SSS) |
| **Three worlds** | Modern (`zh-cn`), Cultivation (`zh-cn-wf`), Fantasy (`zh-cn-cf`) — each with its own events / talents / characters |
| **Bilingual** | Full i18n (zh-cn / en); pixel fonts (Departure Mono + Fusion Pixel) with per-glyph fallback |
| **On-chain randomness** | ARPA Randcast provides a verifiable random seed; wallet users pay their own BNB, guests are sponsored by the backend |
| **Fate inscription (NFT)** | Mint an ERC-721 for 50 ARPA; the fate data (seed / talents / allocation / randomness source) lives fully on-chain |
| **Anti-forgery signing** | Backend EIP-712 authorization + on-chain receipt verification — no faked inscription records |
| **On-chain verify** | Every real inscription on the board can be checked against the contract's `getFate` / `ownerOf` in one click |
| **AI life summary** | Claude writes a concise one-sentence summary (rule-based fallback when no API key) |
| **Fate share card** | Export the result screen as a shareable PNG |
| **Cross-run progression** | Wallet players accumulate attribute points and a wider talent pool across runs (guests are fixed, no accumulation) |

---

## 🏗️ Architecture

```
                    ┌───────────────────────────────────────────────┐
                    │  Frontend  Vite + TypeScript (fixed 750×1334) │
                    │  Core (proxy) → backend API  or  local mock   │
                    │  web3/chain.ts (ethers + MetaMask)            │
                    └───────────────┬───────────────┬───────────────┘
                          REST/JSON │               │ direct wallet (user signs/pays)
                                    ▼               ▼
        ┌─────────────────────────────────────┐   ┌──────────────────────────────┐
        │  Backend  Node + Express (:8787)    │   │  BNB Smart Chain             │
        │  · Deterministic engine (mulberry32)│   │  · InscriptionNFT (ERC-721)  │
        │  · Session API (/game/*)            │◄─►│  · FateRandomnessConsumer    │
        │  · EIP-712 signing / receipt verify │RPC│    ↕ ARPA Randcast           │
        │  · AI summary (Claude / fallback)   │   │  · ARPA (mint-fee token)     │
        │  · operator-sponsored guest seeds   │   └──────────────────────────────┘
        └───────────────┬─────────────────────┘
                        │
                        ▼
        ┌─────────────────────────────────────┐
        │  PostgreSQL (inscriptions/saves/…)  │
        │  auto-falls back to in-memory       │
        └─────────────────────────────────────┘
```

**Content source:** game data (events / talents / ages / characters / worlds) lives in `game-data/zh/` (Chinese) and `game-data/en/` (English) at the repo root, and is loaded by the backend at startup.

---

## 🧰 Tech stack

- **Frontend:** TypeScript + Vite (no UI framework); a hand-rolled game-engine architecture (three-layer rendering View/Dialog/Popup, page lifecycle, global singletons, event bus); `ethers` v6 + MetaMask.
- **Backend:** Node.js + TypeScript + Express; deterministic rules engine; `@anthropic-ai/sdk` (AI summary); `pg` (PostgreSQL, optional); `ethers` (EIP-712 signing + on-chain verification).
- **Contracts:** Solidity + Foundry (forge/anvil/cast); OpenZeppelin; ARPA Randcast.
- **Chain:** BNB Smart Chain (mainnet chainId 56; local anvil 31337).
- **Data pipeline:** Python (stdlib) + DeepSeek/Claude-assisted translation & cleanup scripts.

---

## 📁 Repository layout

```
AoF/
├── README.md                  ← this file (English, default)
├── README.zh-CN.md            Chinese version
└── src/
    ├── front-end/             Vite + TS frontend (in use)
    │   └── src/{core,pages,ui,web3,i18n,styles,...}
    ├── back-end/          Node/Express backend (in use)
    │   └── src/{engine,routes,services,db,...}
    ├── contracts/             Foundry contracts (InscriptionNFT / FateRandomnessConsumer + mocks)
    └── uiux/                  design reference assets
```

---

## 🎮 Game flow

```
Connect wallet / play as guest
   → Talent selection (pick 3; pool grows with progression)
   → Attribute allocation (20 base + wallet accumulation; range widens with progression)
   → Life playback (random events year by year; mythic moments may trigger)
   → Life summary (peak attributes / score / fate level / radar chart)
   → Fate summary (AI one-liner + title + traits)
        ├─ Inscribe (wallet pays 50 ARPA to mint NFT) → Fate Archive board
        └─ Share card (export PNG)
   → Fate Archive (all inscriptions / my atlas / per-record on-chain verify)
```

---

## ⛓️ On-chain & economics

| Step | Who pays | With what | Notes |
|---|---|---|---|
| **Randomness (wallet)** | player's wallet | a little BNB | calls `requestSeed` directly, pays the ARPA Randcast fee |
| **Randomness (guest)** | backend operator (sponsored) | BNB (subscription pool) | frontend caps at **10 runs**; operator calls `requestSeedFor` |
| **Inscription NFT** | player's wallet | **50 ARPA** + gas | `approve` + `mint`; fate data goes on-chain |
| **AI life summary** | operator | Claude API | very short text, tiny per-call cost; rule fallback with no key |

- **Anti-forgery:** the backend signs the inscription parameters with a dedicated `AUTHORIZER` key via EIP-712, which the contract verifies; `/inscribe` then pulls the tx receipt over RPC and only records the entry after tokenId/owner/seed all match.
- **Verify:** anyone can hit "Verify" on the board — the frontend reads the contract's `getFate`/`ownerOf` over a read-only RPC and compares field-by-field with the displayed record.
- **Guests don't accumulate:** guests get a fixed 20 base points and default range; only wallet players progress across runs.

---

## 🚀 Quick start

### Full local end-to-end (recommended first)

Spin up a local chain with Foundry `anvil`, deploy the mock contracts, and run the whole loop — **randomness + inscription + receipt verification + NFT metadata**.

Short version:

```bash
# 1) local chain
anvil                                   # RPC :8545, chainId 31337

# 2) deploy mock contracts (new terminal)
cd src/contracts && forge script script/DeployLocal.s.sol:DeployLocal \
  --rpc-url http://127.0.0.1:8545 --broadcast \
  --skip FateRandomnessConsumer.sol --skip Deploy.s.sol

# 3) backend (fill .env: chain addresses + AUTHORIZER/OPERATOR keys)
cd src/back-end && npm install && npm run dev     # :8787

# 4) frontend (fill .env: VITE_API_BASE + contract addresses)
cd src/front-end && npm install && npm run dev        # :5173
```

### Frontend only (no backend/chain)

When `VITE_API_BASE` is unset, the frontend `core` uses a built-in **mock engine** (deterministic RNG + sample data for all three worlds) and is fully playable on its own:

```bash
cd src/front-end && npm install && npm run dev
```

### Production

- **Frontend:** static build, deploy to Vercel etc. (`npm run build` → `dist/`).
- **Backend:** containerized on AWS App Runner / Lightsail (it holds in-memory session state, so it's not a fit for serverless).
- **Database:** AWS RDS PostgreSQL.

---

## 🔧 Key environment variables

**Frontend `src/front-end/.env`**
```ini
VITE_API_BASE=http://localhost:8787      # unset → local mock engine
VITE_BSC_CHAIN_ID=56                      # mainnet 56; local anvil 31337
VITE_CONSUMER_ADDRESS=0x...               # randomness consumer contract
VITE_INSCRIPTION_NFT=0x...                # inscription NFT contract
VITE_PROJECT_TOKEN=0x...                  # ARPA / mint-fee token
VITE_BSC_RPC=https://bsc-dataseed.binance.org/   # read-only, for verification
```

**Backend `src/back-end/.env`**
```ini
PORT=8787
DATABASE_URL=postgres://...               # unset → in-memory storage
ANTHROPIC_API_KEY=sk-ant-...              # unset → AI summary uses rule fallback
ANTHROPIC_MODEL=claude-haiku-4-5          # optional; defaults to the cheapest tier
BSC_CHAIN_ID=56
BSC_RPC_URL=https://bsc-dataseed.binance.org/
INSCRIPTION_NFT=0x...
RANDCAST_CONSUMER=0x...
AUTHORIZER_PRIVATE_KEY=0x...              # EIP-712 anti-forgery signing (dedicated low-priv hot wallet)
OPERATOR_PRIVATE_KEY=0x...               # sponsors guest randomness (dedicated low-priv hot wallet)
SEED_COST_BNB=0.0002                      # BNB attached to a wallet user's requestSeed
ANON_GAME_LIMIT=10                        # free guest runs
```

> ⚠️ `AUTHORIZER` / `OPERATOR` must be **dedicated low-privilege hot wallets**; never commit `.env` or private keys.

---

## 🔌 Backend API overview

| Method | Path | Purpose |
|---|---|---|
| POST | `/game/new` | Create a session; wallet → await on-chain seed, guest → operator-sponsored seed |
| GET  | `/game/:id` | Poll for seed readiness / opening info |
| POST | `/game/:id/seed` | Wallet: submit the on-chain seed; backend verifies and starts |
| POST | `/game/:id/play` | Submit talents + allocation; returns the year-by-year timeline & summary |
| POST | `/game/:id/inscribe/prepare` | Build the mint tx + EIP-712 signature |
| POST | `/game/:id/inscribe` | Verify the mint receipt → persist → publish to the board |
| GET  | `/registry/list` · `/registry/by_player` | All / per-player inscriptions |
| GET  | `/nft/:tokenId` | Standard ERC-721 metadata |
| GET  | `/health` | Health check (db / ai status) |

---

## 🙏 Acknowledgements

- Inspired by [lifeRestart · 人生重开模拟器](https://github.com/VickScarlet/lifeRestart)
- Randomness by [ARPA Randcast](https://docs.arpanetwork.io/randcast)
- Fonts: [Departure Mono](https://justfreefonts.com/fonts/departure-mono/), [Fusion Pixel](https://github.com/TakWolf/fusion-pixel-font)
