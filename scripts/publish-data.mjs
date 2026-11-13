// Copies the parts of your collection you chose to make public into data/default-collection.json,
// which the GitHub Pages site starts from:
//   - club cards: owned base cards + promo cards (customCards)
//   - SBCs and your progress on them
//   - the Meta cards list
// Targets, saved squads and packs stay private (data/my-collection.json is git-ignored).
//
//   npm run publish-data   then commit data/default-collection.json and data/club-prices.json
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const mine = JSON.parse(readFileSync(resolve(root, 'data/my-collection.json'), 'utf8'))
const out = resolve(root, 'data/default-collection.json')

// Strip import bookkeeping that the site doesn't need.
const owned = (mine.owned ?? []).map((o) => (typeof o === 'object' ? { id: o.id, qty: o.qty ?? 1 } : { id: o, qty: 1 }))
const customCards = (mine.customCards ?? []).map(({ fromClub, ...c }) => c)
const sbcs = (mine.sbcs ?? []).map(({ importedNotes, fromWebApp, ...s }) => s)

const data = {
  publishedAt: new Date().toISOString(),
  owned,
  customCards,
  packs: [],
  sbcs,
  targets: [],
  meta: mine.meta ?? [],
  squads: [],
}
writeFileSync(out, JSON.stringify(data, null, 2) + '\n')
console.log(`Wrote ${owned.length} owned cards, ${customCards.length} promo cards, ${sbcs.length} SBCs and ${data.meta.length} meta cards to data/default-collection.json`)
