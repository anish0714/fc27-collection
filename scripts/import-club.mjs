// Merges a club export from the FC 27 Web App into data/my-collection.json.
//
//   node scripts/import-club.mjs [data/club-export.json]
//
// - Cards whose id is in public/cards.json are added to `owned`.
// - Everything else (promos, heroes, evolutions…) is added to `customCards`,
//   with club / nation / league copied from the player's base card when known.
// Running it again replaces the previous import (entries tagged `fromClub`),
// and leaves anything you added by hand alone.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const exportFile = resolve(root, process.argv[2] ?? 'data/club-export.json')
const collectionFile = resolve(root, 'data/my-collection.json')
const cardsFile = resolve(root, 'public/cards.json')

const club = JSON.parse(readFileSync(exportFile, 'utf8'))
const collection = JSON.parse(readFileSync(collectionFile, 'utf8'))
if (!existsSync(cardsFile)) {
  console.error('public/cards.json is missing. Run `npm run fetch-cards` first.')
  process.exit(1)
}
const cards = new Map(JSON.parse(readFileSync(cardsFile, 'utf8')).cards.map((c) => [Number(c.id), c]))

// EA promo ids are the base id plus a multiple of 2^24.
const baseId = (id) => id % 16777216
const STAT_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy']

const now = new Date().toISOString()
const owned = (collection.owned ?? []).filter((o) => !(typeof o === 'object' && o?.fromClub))
const ownedIds = new Set(owned.map((o) => Number(typeof o === 'object' ? o.id : o)))
const customCards = (collection.customCards ?? []).filter((c) => !c.fromClub)

let base = 0
let special = 0
for (const p of club.players) {
  const id = Number(p.definitionId)
  const isPlainBase = cards.has(id) && (p.rareflag ?? 0) <= 1
  if (isPlainBase) {
    if (!ownedIds.has(id)) {
      owned.push({ id, qty: 1, addedAt: now, fromClub: true })
      ownedIds.add(id)
    }
    base++
    continue
  }
  const ref = cards.get(id) ?? cards.get(baseId(id))
  customCards.push({
    id: `club-${id}`,
    fromClub: true,
    name: p.firstName && p.lastName && p.name.split(' ').length === 1 ? `${p.firstName} ${p.name}` : p.name,
    // A rarity of 0/1 here means a base card with an id EA's ratings list doesn't have (e.g. a re-rated copy).
    version: (p.rareflag ?? 0) <= 1 ? 'Base' : p.version,
    rating: p.rating,
    position: p.position,
    altPositions: (ref?.altPositions ?? []).filter((pos) => pos !== p.position).concat(ref && ref.position !== p.position ? [ref.position] : []),
    gender: p.gender,
    club: ref?.club ?? '',
    clubImg: ref?.clubImg ?? '',
    nation: ref?.nation ?? '',
    nationImg: ref?.nationImg ?? '',
    league: ref?.league ?? '',
    img: ref?.img ?? '',
    stats: p.stats ? Object.fromEntries(STAT_KEYS.map((k, i) => [k, p.stats[i]])) : {},
    ...(p.loan ? { loan: true } : {}),
  })
  special++
}

writeFileSync(collectionFile, JSON.stringify({ ...collection, owned, customCards }, null, 2) + '\n')
console.log(`Imported ${club.players.length} club players: ${base} base cards marked owned, ${special} special cards.`)
