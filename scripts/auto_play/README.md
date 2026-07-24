# Auto Play

A standalone Node.js script that automates the full wallet-connected game loop against the real backend API and BSC mainnet contracts — request seed, pick talents, allocate attribute points, play, and (optionally) inscribe — so you don't have to click through the frontend one run at a time. It mirrors the exact same API/contract calls the frontend makes (see `src/front-end/src/web3/chain.ts` and `src/back-end/src/routes/game.ts`), just driven from a script with a private key instead of MetaMask.

Because the wallet-connected flow persists progress by wallet address on the backend (`player_save`), running this repeatedly against the same wallet accumulates attribute points across runs exactly like manual play would.

## ⚠️ Real money, real mainnet

This script signs and sends real transactions on **BSC Mainnet** with the private key you give it:

- Every round pays real BNB for the Randcast seed request (`requestSeed()`).
- If inscribing, every round also spends 50 project tokens (ARPA) + gas to mint an `InscriptionNFT`.

All of this is irreversible once sent. The script prints your wallet address, BNB balance, and token balance, and requires you to type `yes` to confirm before it starts (unless you pass `--yes`). Use a dedicated low-value wallet, not your main one.

## Setup

```bash
cd scripts/auto_play
npm install
cp .env.example .env
```

Fill in `.env` with the same contract addresses used by the backend/frontend (`RANDCAST_CONSUMER` → `CONSUMER_ADDRESS`, `INSCRIPTION_NFT`, the project ERC-20 token address → `PROJECT_TOKEN`). See `src/contracts/README.md` for where those addresses come from.

## Run

```bash
node auto_play.mjs
```

You'll be prompted for:

1. Your wallet private key (kept in memory only, never written to disk or sent anywhere except used locally to sign transactions).
2. How many rounds to auto-play.
3. Whether to inscribe (mint) at the end of every round.

Then it shows your wallet address, BNB/token balance, and an estimated cost, and asks for a final `yes` before touching the chain.

### Non-interactive mode

All prompted values can be supplied as CLI flags or environment variables (env file or real env vars), which lets the whole run skip prompts entirely:

```bash
node auto_play.mjs --private-key 0x... --rounds 20 --inscribe y --yes
```

| Flag | Env var | Default | Meaning |
|------|---------|---------|---------|
| `--private-key` | `WALLET_PRIVATE_KEY` | (prompt) | Wallet private key |
| `--rounds` | `ROUNDS` | (prompt) | Number of rounds to auto-play |
| `--inscribe` | `INSCRIBE` | (prompt) | `y`/`n` — inscribe after every round |
| `--yes` | — | off | Skip the final confirmation prompt |
| `--api` | `API_BASE` | `http://localhost:8787` | Backend API base URL |
| `--rpc` | `BSC_RPC_URL` | `https://bsc-dataseed.binance.org/` | BSC RPC endpoint |
| `--chain-id` | `BSC_CHAIN_ID` | `56` | Chain id |
| `--consumer` | `CONSUMER_ADDRESS` | — | `FateRandomnessConsumer` address |
| `--nft` | `INSCRIPTION_NFT` | — | `InscriptionNFT` address (only needed if inscribing) |
| `--token` | `PROJECT_TOKEN` | — | Project ERC-20 token address (only needed if inscribing) |
| `--seed-cost` | `SEED_COST_BNB` | `0.0001` | BNB sent with `requestSeed()` (server may override per response) |
| `--language` | `LANGUAGE` | `zh-cn` | `zh-cn` or `en` |
| `--username` | `AOF_CHARACTER_NAME` | — | Fixed character name; random if unset |
| `--delay` | `ROUND_DELAY_MS` | `3000` | Delay between rounds, in ms |
| `--seed-timeout` | `SEED_TIMEOUT_MS` | `240000` | Max time to wait for the Randcast VRF callback after `requestSeed()`, in ms |

Don't name the character-name variable `USERNAME` in your shell/`.env` — Windows already defines a system-wide `USERNAME` environment variable (the logged-in user), which would silently override the character name. That's exactly why this script uses `AOF_CHARACTER_NAME` instead.

## What each round does

1. `POST /game/new` with your wallet address.
2. Depending on the response:
   - `awaiting_seed` (production, real chain configured): call `consumer.requestSeed()` paying BNB, wait for the Randcast callback, then `POST /game/{id}/seed` to verify on-chain.
   - `awaiting_seed_tx` / `pending_seed` (local dev fallback, no chain configured): skip straight to polling `GET /game/{id}` until ready.
3. Pick 3 talents from the returned candidate pool (prefers higher grade, avoids mutually-exclusive pairs) and allocate attribute points evenly across the allowed range up to the spendable budget. Some talents shift the real budget after selection (a `status` bonus/penalty applied server-side); if the initial allocation ends up over budget, the script retries once with the corrected number from the server's error message.
4. `POST /game/{id}/play` to run the full life and get the summary.
5. If inscribing: `POST /game/{id}/inscribe/prepare`, then `token.approve` (if needed) + `nft.mint` on-chain, then `POST /game/{id}/inscribe` to record it.

A failure in one round (network hiccup, RPC timeout, etc.) is logged and the script moves on to the next round rather than aborting the whole batch.
