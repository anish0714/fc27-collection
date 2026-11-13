// Squad builder logic: formations, team rating, chemistry, SBC requirement checks and auto-build.
import { foldText, tierOf } from './cards.js'

// x / y are percentages of the pitch (y = 0 is the opponent's goal line).
const BACK4 = [['LB', 13, 70], ['CB', 37, 76], ['CB', 63, 76], ['RB', 87, 70]]
const BACK3 = [['CB', 27, 75], ['CB', 50, 78], ['CB', 73, 75]]
const GK = [['GK', 50, 92]]
const TWO_ST = [['ST', 37, 15], ['ST', 63, 15]]

export const FORMATIONS = {
  // Slot order matches the meta team templates in data/meta-teams.json: GK, LB, CB, CB, RB, then midfield and attack.
  '4-2-1-3': [...GK, ...BACK4, ['CDM', 36, 56], ['CDM', 64, 56], ['CAM', 50, 38], ['LW', 17, 20], ['ST', 50, 13], ['RW', 83, 20]],
  '4-4-1-1': [...GK, ...BACK4, ['LM', 13, 44], ['CM', 37, 52], ['CM', 63, 52], ['RM', 87, 44], ['CAM', 50, 30], ['ST', 50, 13]],
  '4-3-3 (4)': [...GK, ...BACK4, ['CM', 34, 52], ['CM', 66, 52], ['CAM', 50, 36], ['LW', 17, 20], ['ST', 50, 13], ['RW', 83, 20]],
  '4-3-1-2': [...GK, ...BACK4, ['CM', 26, 50], ['CM', 50, 54], ['CM', 74, 50], ['CAM', 50, 33], ...TWO_ST],
  '4-3-3': [...GK, ...BACK4, ['CM', 26, 48], ['CM', 50, 53], ['CM', 74, 48], ['LW', 17, 22], ['ST', 50, 14], ['RW', 83, 22]],
  '4-3-3 (Holding)': [...GK, ...BACK4, ['CDM', 50, 58], ['CM', 30, 44], ['CM', 70, 44], ['LW', 17, 20], ['ST', 50, 13], ['RW', 83, 20]],
  '4-2-3-1': [...GK, ...BACK4, ['CDM', 36, 57], ['CDM', 64, 57], ['CAM', 20, 34], ['CAM', 50, 36], ['CAM', 80, 34], ['ST', 50, 13]],
  '4-4-2': [...GK, ...BACK4, ['LM', 13, 44], ['CM', 37, 50], ['CM', 63, 50], ['RM', 87, 44], ...TWO_ST],
  '4-1-2-1-2': [...GK, ...BACK4, ['CDM', 50, 60], ['CM', 26, 46], ['CM', 74, 46], ['CAM', 50, 33], ...TWO_ST],
  '4-2-2-2': [...GK, ...BACK4, ['CDM', 36, 57], ['CDM', 64, 57], ['CAM', 22, 33], ['CAM', 78, 33], ...TWO_ST],
  '4-3-2-1': [...GK, ...BACK4, ['CM', 26, 50], ['CM', 50, 54], ['CM', 74, 50], ['CF', 33, 28], ['CF', 67, 28], ['ST', 50, 13]],
  '4-1-4-1': [...GK, ...BACK4, ['CDM', 50, 58], ['LM', 13, 38], ['CM', 37, 42], ['CM', 63, 42], ['RM', 87, 38], ['ST', 50, 13]],
  '3-5-2': [...GK, ...BACK3, ['LM', 11, 44], ['CDM', 37, 56], ['CDM', 63, 56], ['RM', 89, 44], ['CAM', 50, 34], ...TWO_ST],
  '3-4-3': [...GK, ...BACK3, ['LM', 12, 46], ['CM', 37, 50], ['CM', 63, 50], ['RM', 88, 46], ['LW', 18, 20], ['ST', 50, 13], ['RW', 82, 20]],
  '5-3-2': [...GK, ['LWB', 9, 60], ...BACK3, ['RWB', 91, 60], ['CM', 28, 44], ['CM', 50, 47], ['CM', 72, 44], ...TWO_ST],
  '5-2-1-2': [...GK, ['LWB', 9, 58], ...BACK3, ['RWB', 91, 58], ['CM', 34, 48], ['CM', 66, 48], ['CAM', 50, 32], ...TWO_ST],
}

export const slotsOf = (formation) => (FORMATIONS[formation] ?? FORMATIONS['4-3-3']).map(([pos, x, y]) => ({ pos, x, y }))

const isIcon = (c) => /icon/i.test(c?.version ?? '')
const isHero = (c) => /hero/i.test(c?.version ?? '')

export const canPlay = (card, pos) => !!card && (card.position === pos || (card.altPositions ?? []).includes(pos))

// The same player can only appear once, whatever the card version.
export function playerKey(card) {
  const m = /^club-(\d+)$/.exec(String(card.id))
  if (m) return `p${Number(m[1]) % 16777216}`
  if (!card.custom) return `p${card.id}`
  return `n${foldText(card.name)}`
}

// Team rating, FUT style: players above the average count extra.
export function teamRating(cards) {
  const ratings = cards.filter(Boolean).map((c) => c.rating)
  if (!ratings.length) return 0
  const sum = ratings.reduce((a, b) => a + b, 0)
  const avg = sum / 11
  const excess = ratings.reduce((n, r) => n + Math.max(0, r - avg), 0)
  return Math.floor(Math.round((sum + excess) * 100) / 100 / 11)
}

const step = (n, [a, b, c]) => (n >= c ? 3 : n >= b ? 2 : n >= a ? 1 : 0)
const CLUB = [2, 5, 7]
const LEAGUE = [3, 5, 8]
const NATION = [2, 5, 8]

// Returns { perSlot: [0..3 | null], total } for slots aligned with `cards`.
export function chemistry(slots, cards) {
  const clubs = new Map()
  const leagues = new Map()
  const nations = new Map()
  const add = (m, k, n) => k && m.set(k, (m.get(k) ?? 0) + n)
  const inPos = cards.map((c, i) => canPlay(c, slots[i].pos))
  cards.forEach((c, i) => {
    if (!c || !inPos[i]) return
    add(clubs, c.club, 1)
    add(leagues, c.league, isHero(c) ? 2 : 1)
    add(nations, c.nation, isIcon(c) ? 2 : 1)
  })
  const perSlot = cards.map((c, i) => {
    if (!c) return null
    if (!inPos[i]) return 0
    if (isIcon(c) || isHero(c)) return 3
    return Math.min(3, step(clubs.get(c.club) ?? 0, CLUB) + step(leagues.get(c.league) ?? 0, LEAGUE) + step(nations.get(c.nation) ?? 0, NATION))
  })
  return { perSlot, total: perSlot.reduce((n, v) => n + (v ?? 0), 0) }
}

// ---------- SBC requirement checks ----------

const QUALITY = { bronze: 1, silver: 2, gold: 3 }
const qualityOf = (c) => QUALITY[c.tier] ?? QUALITY[tierOf(c.rating)]
const compare = (op, value, target) => (op.startsWith('exact') ? value === target : op.startsWith('min') ? value >= target : value <= target)
const opOf = (s) => foldText(s).replace('.', '')
const maxGroup = (cards, key) => {
  const m = new Map()
  for (const c of cards) if (c[key]) m.set(c[key], (m.get(c[key]) ?? 0) + 1)
  return Math.max(0, ...m.values())
}
const matchesName = (c, name) => {
  const n = foldText(name).trim()
  return [c.nation, c.club, c.league].some((v) => v && (foldText(v) === n || foldText(v).includes(n)))
}

// Splits one SBC checklist line ("Name · req, req, … → reward") into requirement strings.
export function requirementParts(text) {
  let body = String(text).split(' → ')[0]
  if (body.includes(' · ')) body = body.split(' · ').slice(1).join(' · ')
  return body.split(/,\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean)
}

// Returns { text, ok: true | false | null, detail } — ok null means "can't check this one".
export function checkRequirement(text, cards, rating, chem) {
  const players = cards.filter(Boolean)
  let m
  const res = (ok, detail) => ({ text, ok, detail })
  if ((m = /^Team Rating: (Exactly|Min\.?|Max\.?) (\d+)/i.exec(text))) return res(compare(opOf(m[1]), rating, +m[2]), `${rating}`)
  if ((m = /^Total Chemistry: (Exactly|Min\.?|Max\.?) (\d+)/i.exec(text))) return res(compare(opOf(m[1]), chem, +m[2]), `${chem}`)
  if ((m = /^Player Quality: (Exactly|Min\.?|Max\.?) (Bronze|Silver|Gold)/i.exec(text))) {
    const t = QUALITY[m[2].toLowerCase()]
    const bad = players.filter((c) => !compare(opOf(m[1]), qualityOf(c), t))
    return res(players.length > 0 && !bad.length, bad.length ? `${bad.length} don't fit` : 'all fit')
  }
  if ((m = /^(Leagues|Nationalities|Clubs) in Squad: (Exactly|Min\.?|Max\.?) (\d+)/i.exec(text))) {
    const key = { leagues: 'league', nationalities: 'nation', clubs: 'club' }[m[1].toLowerCase()]
    const n = new Set(players.map((c) => c[key]).filter(Boolean)).size
    return res(compare(opOf(m[2]), n, +m[3]), `${n}`)
  }
  if ((m = /^Players from the same (League|Club|Countries\/Regions|Nation): (Min\.?|Max\.?|Exactly) (\d+)/i.exec(text))) {
    const key = { league: 'league', club: 'club', 'countries/regions': 'nation', nation: 'nation' }[m[1].toLowerCase()]
    const n = maxGroup(players, key)
    return res(compare(opOf(m[2]), n, +m[3]), `${n}`)
  }
  if ((m = /^(Bronze|Silver|Gold): (Min\.?|Max\.?|Exactly) (\d+) Players?/i.exec(text))) {
    const t = QUALITY[m[1].toLowerCase()]
    const n = players.filter((c) => qualityOf(c) === t).length
    return res(compare(opOf(m[2]), n, +m[3]), `${n}`)
  }
  if ((m = /^OVR (Min|Max): (\d+)/i.exec(text))) {
    const bad = players.filter((c) => !compare(m[1].toLowerCase(), c.rating, +m[2]))
    return res(players.length > 0 && !bad.length, bad.length ? `${bad.length} don't fit` : 'all fit')
  }
  if ((m = /^OVR Between: (\d+) and (\d+)/i.exec(text))) {
    const bad = players.filter((c) => c.rating < +m[1] || c.rating > +m[2])
    return res(players.length > 0 && !bad.length, bad.length ? `${bad.length} don't fit` : 'all fit')
  }
  if ((m = /^(League|Club|Nation|Country\/Region): (.+)$/i.exec(text))) {
    const bad = players.filter((c) => !matchesName(c, m[2]))
    return res(players.length > 0 && !bad.length, bad.length ? `${bad.length} don't fit` : 'all fit')
  }
  if ((m = /^(.+?): (Min\.?|Max\.?|Exactly) (\d+) Players?$/i.exec(text))) {
    const names = m[1].split(/\s+OR\s+/i)
    const n = players.filter((c) => names.some((name) => matchesName(c, name))).length
    return res(compare(opOf(m[2]), n, +m[3]), `${n}`)
  }
  return res(null, '')
}

// ---------- Auto-build ----------

const WEIGHTS = { rating: 0.4, balanced: 3, chemistry: 12 }

function score(slots, cards, mode) {
  const sum = cards.reduce((n, c) => n + (c?.rating ?? 0), 0)
  return sum + WEIGHTS[mode] * chemistry(slots, cards).total + cards.filter(Boolean).length * 100
}

// Fills the unlocked slots from `pool` to maximise rating and/or chemistry.
// `current` holds cards (or null) per slot; `locked` is a Set of slot indexes to keep.
export function autoBuild(slots, pool, current, locked, mode = 'balanced') {
  const cards = slots.map((_, i) => (locked.has(i) ? current[i] ?? null : null))
  const used = () => new Set(cards.filter(Boolean).map(playerKey))
  const eligible = (i) => pool.filter((c) => canPlay(c, slots[i].pos))

  // Greedy start: hardest-to-fill slots first, best rating wins.
  const order = slots.map((_, i) => i).filter((i) => !locked.has(i)).sort((a, b) => eligible(a).length - eligible(b).length)
  for (const i of order) {
    const taken = used()
    cards[i] = eligible(i).filter((c) => !taken.has(playerKey(c))).sort((a, b) => b.rating - a.rating)[0] ?? null
  }

  // Hill-climb: swap in whichever player improves the score most, until nothing helps.
  let best = score(slots, cards, mode)
  for (let pass = 0; pass < 12; pass++) {
    let improved = false
    for (const i of order) {
      const taken = used()
      if (cards[i]) taken.delete(playerKey(cards[i]))
      let pick = null
      for (const c of eligible(i)) {
        if (taken.has(playerKey(c)) || c === cards[i]) continue
        const prev = cards[i]
        cards[i] = c
        const s = score(slots, cards, mode)
        cards[i] = prev
        if (s > best + 1e-9) {
          best = s
          pick = c
        }
      }
      if (pick) {
        cards[i] = pick
        improved = true
      }
    }
    if (!improved) break
  }
  return cards
}
