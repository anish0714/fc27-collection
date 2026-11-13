# FC 27 Collection

A tracker for an EA SPORTS FC 27 Ultimate Team card collection. It shows every FC 27 card: cards you own are in full colour, cards you don't own are grayed out.

Tabs:

- **Cards**: every FC 27 card, owned or missing.
- **Squad builder**: pick a formation and fill the pitch from your club or from every card. It shows team rating and chemistry live; chemistry uses the club / league / nation thresholds, Icons and Heroes always get 3, and a player out of position gets 0. **Auto-build** fills the squad from your club for highest rating, balanced, or max chemistry, and keeps players you lock. **Check against an SBC** shows which requirements of an SBC squad you meet. Squads you save are stored in `squads`.
- **SBCs**: SBCs you plan to do, with reward, expiry countdown, estimated coin cost and a checklist of the squads. Ticking every squad marks the SBC done.
  - **Est. cost / plan**: for every open SBC, the planner covers each squad with your club players first (cheapest fodder, untradeables first) and prices whatever is left at transfer-market rates. Score-based SBCs ("submit 42,000 score") use each card's real SBC score from the Web App; squad SBCs aim for the team rating, quality and "X OR Y: Min. N players" requirements. Chemistry and some squad-count requirements are shown as "?"; check them in the Squad builder.
  - Click an SBC's name or "View plan" to open its page (`#sbc-<id>`, so ctrl-click opens it in a new tab). It describes how to complete each squad, lists what to buy (rating, quantity, price), which of your club players to use, and which players were kept out and why.
  - Players the planner never uses: players in your Web App squads (`data/ea-squads.json`, all six squads by default, or only the active one), squads saved in the Squad builder, players on your Meta list or Squad targets, cards rated 85+, and promo cards rated 84+. You can change these in the "Never use" bar. A club card is only used if that's cheaper than buying fodder.
  - The total at the top shares club players across SBCs in order of expiry, so nobody is counted twice.
  - Market prices and scores by rating live in `data/prices.json` (sampled from the Web App transfer market). Edit `priceByRating` if the market moves. Your own cards' exact scores and values are in `data/club-prices.json` (local only).
- **Squad targets**: cards that would improve your team, with price, priority and who they replace. The tab shows the coins you still need.
- **Meta cards**: the cards everyone is using, in S / A / B tiers with a source link. "Add to targets" copies one into Squad targets, and "In club" means you already own a card of that player.
- **Packs opened**: a log of your pack pulls.

Live site: https://anish0714.github.io/fc27-collection/ (deployed from `main` by `.github/workflows/deploy.yml`).

## Personal data stays local

Your own data is git-ignored and never pushed:

| File | What's in it |
| --- | --- |
| `data/my-collection.json` | Cards you own, promo cards, packs, SBCs, targets, saved squads |
| `data/club-export.json` | Snapshot of your club from the Web App |
| `data/ea-squads.json` | Your Web App squads |
| `data/sbc-export.json` | Snapshot of the Web App SBC hub |
| `data/club-prices.json` | SBC score and market value of each card in your club |

The app builds without them. The public site starts from `data/default-collection.json` (just the Meta cards list) and saves anything you add in your browser's localStorage. Use **Export** / **Import** to move data between your PC and the site.

## Importing your club from the FC 27 Web App

`data/club-export.json` is a snapshot of the players in your club, read from the FC 27 Web App while you're signed in. To merge it into your collection:

```bash
npm run import-club
```

Base cards that are in `public/cards.json` go into `owned`. Everything else (TOTW, RTTK, Heroes, Future Stars…) goes into `customCards`, with club, nation and league copied from the player's base card. Imported entries are tagged `fromClub: true`, so running the import again replaces them and leaves anything you added by hand alone. To refresh the snapshot, sign in to the Web App and export the club again.

SBCs work the same way. `data/sbc-export.json` is a snapshot of the Web App's SBC hub, and this command merges it into `sbcs`:

```bash
npm run import-sbcs
```

Each SBC set becomes one entry, with one checklist line per challenge, covering requirements, score to submit and reward. Running the command again refreshes those entries. It keeps the cost and notes you typed and any SBC you marked skipped, and it leaves SBCs you added by hand alone.

## Setup

Requires Node 20.19+ (for Vite 8). The fetch script itself only needs Node 18+.

```bash
npm install
npm run fetch-cards   # downloads ~20,000 cards into public/cards.json
npm run dev           # http://localhost:5173
```

Re-run `npm run fetch-cards` whenever EA updates ratings, then commit `public/cards.json` so the live site picks up the new ratings.

### Why a fetch script?

The data comes from EA's official ratings API (`https://drop-api.ea.com/rating/ea-sports-fc`). That API only allows browser requests from ea.com (CORS), so the React app can't call it; `scripts/fetch-cards.mjs` downloads it instead.

- The endpoint returns **FC 26** by default. The script sends `drop-referrer: https://www.ea.com/games/ea-sports-fc/ratings` to get FC 27, and adds `&_e=fc27` to every URL because EA's CDN caches by URL only.
- It fetches page 0 with and without that header and warns if both are identical (which would mean the data might be last year's).
- Pages of 100 are fetched 5 at a time, with up to 3 retries each.
- Set `FC_API` to point at a different endpoint for testing: `FC_API=http://localhost:4000/rating npm run fetch-cards`.

## Your collection: `data/my-collection.json`

```json
{
  "owned": [
    { "id": 231747, "qty": 1, "addedAt": "2026-09-26T10:00:00.000Z" },
    209331
  ],
  "customCards": [
    {
      "id": "totw1-mbappe",
      "name": "Kylian Mbappé",
      "version": "TOTW",
      "rating": 94,
      "position": "ST",
      "club": "Real Madrid",
      "nation": "France",
      "league": "LALIGA EA SPORTS",
      "stats": { "pac": 98, "sho": 94, "pas": 82, "dri": 94, "def": 36, "phy": 80 }
    }
  ],
  "packs": [
    {
      "id": "2026-09-26-gold",
      "name": "Premium Gold Pack",
      "openedAt": "2026-09-26T12:00:00.000Z",
      "note": "Daily reward",
      "pulls": [{ "id": 231747 }, { "name": "Kylian Mbappé", "rating": 94, "version": "TOTW" }]
    }
  ]
}
```

| Field | Description |
| --- | --- |
| `owned` | EA player ids you own: `{ id, qty, addedAt }` or just the id as a number. `qty > 1` shows a ×N badge. |
| `customCards` | Promo cards that aren't in EA's ratings database (TOTW, Icons, Heroes, evolutions). `id` is a string. Always shown as owned, with a purple "special" style. Goalkeepers use the same `pac…phy` keys in DIV/HAN/KIC/REF/SPE/POS order. Optional: `img`, `nationImg`, `clubImg`, `gender` (`"M"`/`"W"`). |
| `packs` | Packs you opened. Each pull is either `{ id }` (an EA id or a custom card id) or `{ name, rating, version }`. |
| `sbcs` | `{ id, name, category, reward, expires, cost, repeatable, status, requirements: [{ text, done }], notes }`. `status` is `todo`, `doing`, `done` or `skipped`. |
| `targets` | `{ id, name, version, rating, position, price, priority, replaces, why, status }`. `priority` is `high`, `med` or `low`; `status` is `want` or `got`. |
| `meta` | `{ id, name, version, rating, position, tier, source, price, playstyles, notes, link }`. `tier` is `S`, `A` or `B`. |

### How saving works

- **`npm run dev`**: a small Vite dev-server plugin exposes `GET`/`PUT /api/collection`, so ticking cards in the app (enable **Tap cards to mark owned**) writes straight to `data/my-collection.json`.
- **Static build** (`npm run build` / `npm run preview` / any static host): there is no API, so changes are saved to the browser's localStorage, starting from the collection bundled at build time. Use **Export** / **Import** to move the JSON between the two.

## Notes

Unofficial fan project, not affiliated with EA. Player data and images © EA SPORTS. EA's ratings database only contains base cards, which is why promos go in `customCards`.
