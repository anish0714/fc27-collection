#!/usr/bin/env node
// Downloads every EA SPORTS FC 27 card from EA's official ratings API and
// writes a compact public/cards.json for the app.
//
// Why a script: drop-api.ea.com only allows browser requests from ea.com
// (CORS), so the React app can't fetch it directly.
//
// Usage: npm run fetch-cards
//        FC_API=http://localhost:4000/rating npm run fetch-cards   (testing)

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENDPOINT = process.env.FC_API || 'https://drop-api.ea.com/rating/ea-sports-fc'
// Without this header the endpoint serves last year's game (FC 26).
const FC27_HEADERS = { 'drop-referrer': 'https://www.ea.com/games/ea-sports-fc/ratings' }
const PAGE_SIZE = 100
const CONCURRENCY = 5
const RETRIES = 3

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = resolve(ROOT, 'public', 'cards.json')

function pageUrl(offset, cacheKey = 'fc27') {
  const url = new URL(ENDPOINT)
  url.searchParams.set('locale', 'en')
  url.searchParams.set('limit', String(PAGE_SIZE))
  url.searchParams.set('offset', String(offset))
  // EA's CDN caches by URL only (it ignores the header), so bust the cache.
  url.searchParams.set('_e', cacheKey)
  return url
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(offset, { fc27 = true } = {}) {
  // The header-less check uses its own cache key so the CDN can't hand it the
  // FC 27 response we just requested (or vice versa).
  const url = pageUrl(offset, fc27 ? 'fc27' : 'default')
  const headers = { accept: 'application/json', ...(fc27 ? FC27_HEADERS : {}) }
  let lastError
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { headers })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const json = await res.json()
      if (!Array.isArray(json.items)) throw new Error('response has no items array')
      return json
    } catch (err) {
      lastError = err
      if (attempt < RETRIES) await sleep(500 * 2 ** attempt)
    }
  }
  throw new Error(`offset ${offset} failed after ${RETRIES + 1} attempts: ${lastError.message}`)
}

const tierOf = (rating) => (rating >= 75 ? 'gold' : rating >= 65 ? 'silver' : 'bronze')
const statValue = (stats, key) => stats?.[key]?.value ?? null

function mapCard(item) {
  const firstName = item.firstName ?? ''
  const lastName = item.lastName ?? ''
  const rating = item.overallRating ?? 0
  const stats = item.stats ?? {}
  return {
    id: item.id,
    name: item.commonName || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    rating,
    tier: tierOf(rating),
    position: item.position?.shortLabel ?? '',
    altPositions: (item.alternatePositions ?? []).map((p) => p.shortLabel),
    nation: item.nationality?.label ?? '',
    nationImg: item.nationality?.imageUrl ?? '',
    club: item.team?.label ?? '',
    clubImg: item.team?.imageUrl ?? '',
    league: item.leagueName ?? '',
    gender: item.gender?.id === 1 ? 'W' : 'M',
    skillMoves: item.skillMoves ?? null,
    weakFoot: item.weakFootAbility ?? null,
    foot: item.preferredFoot === 1 ? 'R' : 'L',
    img: item.avatarUrl ?? '',
    shield: item.shieldUrl ?? '', // EA's official rendered card image
    stats: {
      pac: statValue(stats, 'pac'),
      sho: statValue(stats, 'sho'),
      pas: statValue(stats, 'pas'),
      dri: statValue(stats, 'dri'),
      def: statValue(stats, 'def'),
      phy: statValue(stats, 'phy'),
    },
  }
}

async function main() {
  console.log(`Fetching FC 27 cards from ${ENDPOINT}`)

  const [first, withoutHeader] = await Promise.all([
    fetchPage(0),
    fetchPage(0, { fc27: false }).catch((err) => {
      console.warn(`  (sanity check request without header failed: ${err.message})`)
      return null
    }),
  ])

  const total = first.totalItems ?? first.items.length
  if (
    withoutHeader &&
    withoutHeader.totalItems === first.totalItems &&
    withoutHeader.items[0]?.id === first.items[0]?.id
  ) {
    console.warn(
      '\n⚠  WARNING: responses with and without the drop-referrer header are identical ' +
        `(totalItems ${total}, first id ${first.items[0]?.id}).\n` +
        "   The data might be last year's game (FC 26), not FC 27.\n",
    )
  } else if (withoutHeader) {
    console.log(
      `  Sanity check OK: FC 27 has ${total} items (default/older data has ${withoutHeader.totalItems}).`,
    )
  }

  const offsets = []
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) offsets.push(offset)

  const items = [...first.items]
  let done = 1
  const pages = offsets.length + 1
  for (let i = 0; i < offsets.length; i += CONCURRENCY) {
    const batch = offsets.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map((offset) => fetchPage(offset)))
    for (const r of results) items.push(...r.items)
    done += batch.length
    process.stdout.write(`\r  Pages ${done}/${pages} (${items.length} items)`)
  }
  process.stdout.write('\n')

  const byId = new Map()
  for (const item of items) {
    if (item?.id != null && !byId.has(item.id)) byId.set(item.id, mapCard(item))
  }
  const cards = [...byId.values()].sort(
    (a, b) => b.rating - a.rating || a.name.localeCompare(b.name),
  )

  const out = { game: 'FC 27', fetchedAt: new Date().toISOString(), count: cards.length, cards }
  await mkdir(dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(out))

  const duplicates = items.length - cards.length
  console.log(
    `Saved ${cards.length} cards to public/cards.json` +
      (duplicates ? ` (${duplicates} duplicates removed)` : ''),
  )
  if (cards.length < total) {
    console.warn(`⚠  Expected ${total} items but only got ${cards.length} unique cards.`)
  }
}

main().catch((err) => {
  console.error(`\nfetch-cards failed: ${err.message}`)
  process.exit(1)
})
