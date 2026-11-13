// SBC solver: covers an SBC squad with players from your club first, then estimates
// what you'd need to buy on the transfer market and how much it costs.
//
// Two kinds of FC 27 SBC squads:
// - score-based ("one-click"): submit players until their SBC score reaches a target
// - squad-based: an 11-player squad meeting rating / quality / nation… requirements
import marketPrices from '../../data/prices.json'

// Per-card SBC scores and market values of your own club are personal (data/club-prices.json, git-ignored).
const clubPrices = Object.values(import.meta.glob('../../data/club-prices.json', { eager: true, import: 'default' }))[0] ?? {}
const prices = { ...marketPrices, clubScores: clubPrices.clubScores ?? {}, clubValues: clubPrices.clubValues ?? {} }
import { foldText, tierOf } from './cards.js'
import { checkRequirement, playerKey, requirementParts, teamRating } from './squad.js'

const MIN_OVR = 45
const MAX_OVR = 95

function interp(table, r) {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b)
  if (r <= keys[0]) return table[keys[0]]
  if (r >= keys.at(-1)) return table[keys.at(-1)]
  const hi = keys.find((k) => k >= r)
  if (hi === r) return table[r]
  const lo = keys[keys.indexOf(hi) - 1]
  return Math.round(table[lo] + ((table[hi] - table[lo]) * (r - lo)) / (hi - lo))
}

export const marketPrice = (r) => interp(prices.priceByRating, r)
export const marketScore = (r) => interp(prices.scoreByRating, r)

function defIdOf(card) {
  const m = /^club-(\d+)$/.exec(String(card.id))
  if (m) return m[1]
  return card.custom ? null : String(card.id)
}

// SBC score of one of your cards: the Web App's own number when we have it.
export function cardScore(card) {
  const def = defIdOf(card)
  const known = def != null ? prices.clubScores[def] : undefined
  return known ?? Math.round(marketScore(card.rating) * (card.custom ? 1.25 : 1))
}

// Coins you'd give up by using this card (0 for untradeable cards).
export function cardValue(card) {
  const def = defIdOf(card)
  const known = def != null ? prices.clubValues[def] : undefined
  if (known === -1) return { value: 0, untradeable: true }
  if (known != null) return { value: known, untradeable: false }
  return { value: card.custom ? 0 : marketPrice(card.rating), untradeable: !!card.custom }
}

const QUALITY = { bronze: [MIN_OVR, 64], silver: [65, 74], gold: [75, MAX_OVR] }
const tierFor = (r) => tierOf(r)

// ---------- requirement parsing ----------

export function parseRequirement(text) {
  const parts = requirementParts(text)
  const req = { parts, score: 0, ovrMin: MIN_OVR, ovrMax: MAX_OVR, league: null, teamRating: 0, groups: [], tierMin: {}, other: [] }
  const scoreMatch = /submit ([\d,]+) score/i.exec(text)
  if (scoreMatch) req.score = Number(scoreMatch[1].replace(/,/g, ''))
  for (const p of parts) {
    let m
    if (/^submit [\d,]+ score$/i.test(p)) continue
    if ((m = /^OVR Min: (\d+)/i.exec(p))) req.ovrMin = Math.max(req.ovrMin, +m[1])
    else if ((m = /^OVR Max: (\d+)/i.exec(p))) req.ovrMax = Math.min(req.ovrMax, +m[1])
    else if ((m = /^OVR Between: (\d+) and (\d+)/i.exec(p))) {
      req.ovrMin = Math.max(req.ovrMin, +m[1])
      req.ovrMax = Math.min(req.ovrMax, +m[2])
    } else if ((m = /^League: (.+)$/i.exec(p))) req.league = m[1]
    else if ((m = /^Team Rating: Min\.? (\d+)/i.exec(p))) req.teamRating = +m[1]
    else if ((m = /^Player Quality: (Exactly|Min\.?|Max\.?) (Bronze|Silver|Gold)/i.exec(p))) {
      const [lo, hi] = QUALITY[m[2].toLowerCase()]
      const op = m[1].toLowerCase()
      if (op.startsWith('exact')) {
        req.ovrMin = Math.max(req.ovrMin, lo)
        req.ovrMax = Math.min(req.ovrMax, hi)
      } else if (op.startsWith('min')) req.ovrMin = Math.max(req.ovrMin, lo)
      else req.ovrMax = Math.min(req.ovrMax, hi)
    } else if ((m = /^(Bronze|Silver|Gold): Min\.? (\d+) Players?/i.exec(p))) req.tierMin[m[1].toLowerCase()] = +m[2]
    else if ((m = /^(.+?): Min\.? (\d+) Players?$/i.exec(p))) req.groups.push({ names: m[1].split(/\s+OR\s+/i), min: +m[2], label: m[1] })
    else req.other.push(p)
  }
  return req
}

const nameMatch = (card, names) =>
  names.some((n) => {
    const f = foldText(n).trim()
    return [card.nation, card.club, card.league].some((v) => v && (foldText(v) === f || foldText(v).includes(f)))
  })

function eligible(card, req) {
  if (card.rating < req.ovrMin || card.rating > req.ovrMax) return false
  if (req.league && !(card.league && foldText(card.league).includes(foldText(req.league)))) return false
  return true
}

// ---------- pool of your club cards ----------

// opts: { isKept: card => reason | null, used: Set }
function clubPool(clubCards, req, opts) {
  const isKept = opts.isKept ?? (() => null)
  return clubCards
    .filter((c) => eligible(c, req) && !isKept(c) && !opts.used.has(playerKey(c)))
    .map((c) => ({ card: c, key: playerKey(c), score: cardScore(c), ...cardValue(c) }))
}

// Club cards that would fit this squad but are kept out, with the reason.
export function keptFor(text, clubCards, isKept) {
  const req = parseRequirement(text)
  return clubCards
    .filter((c) => eligible(c, req))
    .map((c) => ({ card: c, reason: isKept(c) }))
    .filter((x) => x.reason)
    .sort((a, b) => b.card.rating - a.card.rating)
}

// One plain-language paragraph describing how to complete a squad.
export function describePlan(text, result) {
  const req = parseRequirement(text)
  const n = (x) => Math.round(x).toLocaleString()
  const buyList = result.buy.map((b) => `${b.count} × ${b.label && b.label !== 'Any player' ? b.label.replace(/ player$/, '') + ' player' : `${b.rating}-rated player`}`).join(', ')
  const limits = [req.ovrMin > MIN_OVR && `rated ${req.ovrMin}+`, req.ovrMax < MAX_OVR && `rated ${req.ovrMax} or lower`, req.league && `from ${req.league}`].filter(Boolean).join(', ')
  if (result.kind === 'score') {
    const parts = [`Submit players worth ${n(result.target)} SBC score${limits ? ` (${limits})` : ''}.`]
    if (result.club.length) parts.push(`${result.club.length} player${result.club.length === 1 ? '' : 's'} from your club give${result.club.length === 1 ? 's' : ''} ${n(result.clubScore)} score.`)
    if (result.buy.length) parts.push(`Buy ${buyList} to cover the remaining ${n(Math.max(0, result.target - result.clubScore))}, about ${n(result.buyCost)} coins.`)
    else parts.push('You don’t need to buy anyone.')
    return parts.join(' ')
  }
  const players = (k) => `${k} player${k === 1 ? '' : 's'}`
  const parts = [`Build an ${result.size}-player squad${req.teamRating ? ` rated ${req.teamRating}+` : ''}${limits ? `, players ${limits}` : ''}.`]
  for (const g of req.groups) parts.push(`Include at least ${players(g.min)} from ${g.names.join(' or ')}.`)
  if (result.club.length) parts.push(`Use ${players(result.club.length)} from your club.`)
  if (result.buy.length) parts.push(`Buy ${buyList}, about ${n(result.buyCost)} coins.`)
  else parts.push('You don’t need to buy anyone.')
  if (result.checks.some((c) => c.ok === null)) parts.push('Then check chemistry and the club / league / nation counts in the Squad builder.')
  return parts.join(' ')
}

// ---------- score-based ----------

const TAX = 0.95 // you'd only get 95% of a card's value if you sold it

function solveScore(req, clubCards, opts) {
  const ratings = []
  for (let r = Math.max(req.ovrMin, MIN_OVR); r <= Math.min(req.ovrMax, MAX_OVR); r++) ratings.push({ r, price: marketPrice(r), score: marketScore(r) })
  const best = ratings.reduce((a, b) => (b.price / b.score < a.price / a.score ? b : a), ratings[0])
  const bestRatio = best ? best.price / best.score : Infinity
  // Only use a club card when that's cheaper per score point than buying fodder.
  const pool = clubPool(clubCards, req, opts).filter((p) => p.score > 0 && (p.value * TAX) / p.score <= bestRatio)
  pool.sort((a, b) => a.value / a.score - b.value / b.score || b.score - a.score)
  const picked = []
  let total = 0
  for (const p of pool) {
    if (total >= req.score) break
    picked.push(p)
    total += p.score
  }
  // Drop the most valuable picks we don't actually need.
  for (const p of [...picked].sort((a, b) => b.value - a.value)) {
    if (total - p.score >= req.score) {
      picked.splice(picked.indexOf(p), 1)
      total -= p.score
    }
  }

  // Buy the rest: cheapest coins per score point, finishing with the cheapest card that closes the gap.
  const buys = new Map()
  let remaining = Math.max(0, req.score - total)
  let guard = 0
  while (remaining > 0 && best && guard++ < 5000) {
    const finisher = ratings.filter((x) => x.score >= remaining).sort((a, b) => a.price - b.price)[0]
    const pick = finisher && finisher.price <= best.price * Math.ceil(remaining / best.score) ? finisher : best
    buys.set(pick.r, (buys.get(pick.r) ?? 0) + 1)
    remaining -= pick.score
  }
  const buy = [...buys].map(([r, count]) => ({ rating: r, count, price: marketPrice(r), score: marketScore(r) })).sort((a, b) => b.rating - a.rating)
  return {
    kind: 'score',
    target: req.score,
    club: picked,
    clubScore: total,
    clubValue: picked.reduce((n, p) => n + p.value, 0),
    buy,
    buyScore: buy.reduce((n, b) => n + b.score * b.count, 0),
    buyCost: buy.reduce((n, b) => n + b.price * b.count, 0),
    checks: [],
  }
}

// ---------- squad-based ----------

function cheapestMarketRating(lo, hi) {
  let best = null
  for (let r = Math.max(lo, MIN_OVR); r <= Math.min(hi, MAX_OVR); r++) if (!best || marketPrice(r) < marketPrice(best)) best = r
  return best
}

const marketPick = (rating, label, extra = {}) => ({
  market: true,
  rating,
  value: marketPrice(rating),
  label,
  card: { id: `market-${label}-${rating}-${Math.random()}`, name: label, rating, tier: tierFor(rating), ...extra },
})

function solveSquad(req, clubCards, opts, size = 11) {
  const pool = clubPool(clubCards, req, opts).sort((a, b) => a.value - b.value || a.card.rating - b.card.rating)
  const taken = new Set()
  const picks = []
  const take = (p, pin) => {
    taken.add(p.key)
    picks.push(pin ? { ...p, group: pin } : p)
  }

  // Players a requirement names ("Portugal OR Denmark: Min. 1 Player").
  for (const g of req.groups) {
    const have = picks.filter((p) => !p.market && nameMatch(p.card, g.names)).length
    let need = g.min - have
    for (const p of pool) {
      if (need <= 0) break
      if (!taken.has(p.key) && nameMatch(p.card, g.names)) {
        take(p, g) // pinned: the rating step must not swap it out
        need--
      }
    }
    while (need-- > 0) picks.push({ ...marketPick(cheapestMarketRating(req.ovrMin, req.ovrMax), `${g.label} player`), group: g })
  }
  // "Gold: Min. 1 Players" and similar.
  for (const [tier, min] of Object.entries(req.tierMin)) {
    const [lo, hi] = QUALITY[tier]
    let need = min - picks.filter((p) => p.card.rating >= lo && p.card.rating <= hi).length
    for (const p of pool) {
      if (need <= 0) break
      if (!taken.has(p.key) && p.card.rating >= lo && p.card.rating <= hi) {
        take(p, { tier })
        need--
      }
    }
    while (need-- > 0) picks.push({ ...marketPick(cheapestMarketRating(Math.max(lo, req.ovrMin), Math.min(hi, req.ovrMax)), `${tier} player`), group: { tier } })
  }
  // Fill the rest as cheaply as possible.
  const cheapestBuy = cheapestMarketRating(req.ovrMin, req.ovrMax)
  for (const p of pool) {
    if (picks.length >= size) break
    if (taken.has(p.key)) continue
    if (cheapestBuy != null && p.value > marketPrice(cheapestBuy)) break
    take(p)
  }
  while (picks.length < size && cheapestBuy != null) picks.push(marketPick(cheapestBuy, 'Any player'))

  // Raise the team rating with the cheapest upgrades.
  const rating = () => teamRating(picks.map((p) => p.card))
  let guard = 0
  while (req.teamRating && rating() < req.teamRating && guard++ < 300) {
    let bestMove = null
    picks.forEach((cur, i) => {
      if (cur.group) return
      const consider = (next, cost) => {
        if (next.card.rating <= cur.card.rating) return
        const gain = next.card.rating - cur.card.rating
        const per = cost / gain
        if (!bestMove || per < bestMove.per) bestMove = { i, next, per }
      }
      for (const p of pool) if (!taken.has(p.key)) consider(p, p.value - cur.value)
      for (let r = cur.card.rating + 1; r <= Math.min(cur.card.rating + 6, req.ovrMax); r++) consider(marketPick(r, 'Any player'), marketPrice(r) - cur.value)
    })
    if (!bestMove) break
    const old = picks[bestMove.i]
    if (!old.market) taken.delete(old.key)
    if (!bestMove.next.market) taken.add(bestMove.next.key)
    picks[bestMove.i] = bestMove.next
  }

  const cards = picks.map((p) => p.card)
  const finalRating = rating()
  // Chemistry depends on positions, so we can't promise it here.
  const checks = req.parts.map((t) => {
    if (/chemistry/i.test(t)) return { text: t, ok: null, detail: 'check in Squad builder' }
    const hasMarket = picks.some((p) => p.market)
    const c = checkRequirement(t, cards, finalRating, 0)
    if (hasMarket && /in Squad|same (Club|League|Countries|Nation)/i.test(t)) return { ...c, ok: null, detail: 'depends on who you buy' }
    return c
  })
  const club = picks.filter((p) => !p.market)
  const buys = new Map()
  for (const p of picks.filter((x) => x.market)) {
    const k = `${p.label}|${p.rating}`
    const b = buys.get(k) ?? { rating: p.rating, label: p.label, count: 0, price: marketPrice(p.rating) }
    b.count++
    buys.set(k, b)
  }
  const buy = [...buys.values()].sort((a, b) => b.rating - a.rating)
  return {
    kind: 'squad',
    size,
    rating: finalRating,
    targetRating: req.teamRating,
    club,
    clubValue: club.reduce((n, p) => n + p.value, 0),
    buy,
    buyCost: buy.reduce((n, b) => n + b.price * b.count, 0),
    checks,
  }
}

// ---------- public API ----------

export function solveRequirement(text, clubCards, opts) {
  const req = parseRequirement(text)
  if (req.score) return solveScore(req, clubCards, opts)
  return solveSquad(req, clubCards, opts)
}

// Solves every unfinished squad of an SBC, never using the same club player twice.
// Pass a shared `used` set to plan several SBCs in a row without reusing players.
export function solveSbc(sbc, clubCards, { isKept = () => null, used = new Set() } = {}) {
  const parts = []
  for (const [i, r] of sbc.requirements.entries()) {
    if (r.done) continue
    const result = solveRequirement(r.text, clubCards, { isKept, used })
    for (const p of result.club) used.add(p.key)
    parts.push({ index: i, text: r.text, result })
  }
  return {
    parts,
    buyCost: parts.reduce((n, p) => n + p.result.buyCost, 0),
    clubValue: parts.reduce((n, p) => n + p.result.clubValue, 0),
    clubCount: parts.reduce((n, p) => n + p.result.club.length, 0),
    buyCount: parts.reduce((n, p) => n + p.result.buy.reduce((m, b) => m + b.count, 0), 0),
  }
}

export const pricesInfo = { updatedAt: prices.updatedAt, source: prices.source }
