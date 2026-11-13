// Which club players the SBC planner must never use as fodder, and why.
import { foldText } from './cards.js'
import { playerKey } from './squad.js'

// data/ea-squads.json (your Web App squads) is personal and git-ignored; it may be missing.
const eaSquads = Object.values(import.meta.glob('../../data/ea-squads.json', { eager: true, import: 'default' }))[0] ?? { squads: [] }

const KEY = 'fc27-keep-settings'

export const DEFAULT_KEEP = {
  eaSquads: 'all', // 'all' | 'active' | 'none': players in your Web App squads
  savedSquads: true, // squads saved in the Squad builder
  rating: 85, // keep any card rated this or higher
  promoRating: 84, // keep promo cards rated this or higher
}

export function readKeep() {
  try {
    return { ...DEFAULT_KEEP, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULT_KEEP }
  }
}

export function saveKeep(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

export const eaSquadList = eaSquads.squads

const defIdOf = (card) => {
  const m = /^club-(\d+)$/.exec(String(card.id))
  return m ? Number(m[1]) : card.custom ? null : Number(card.id)
}
const namesOf = (c) => [c.name, `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()].filter(Boolean).map(foldText)

// Returns card => reason string (kept) or null (free to use).
export function makeKeeper({ settings, savedSquads = [], lookup, meta = [], targets = [] }) {
  const inEa = new Map()
  for (const s of eaSquads.squads) {
    if (settings.eaSquads === 'none' || (settings.eaSquads === 'active' && !s.active)) continue
    for (const id of [...s.starters, ...s.subs]) if (!inEa.has(id)) inEa.set(id, s.name)
  }
  const inSaved = new Map()
  if (settings.savedSquads) {
    for (const s of savedSquads) for (const id of s.ids ?? []) {
      const c = id != null && lookup?.get(String(id))
      if (c && !inSaved.has(playerKey(c))) inSaved.set(playerKey(c), s.name)
    }
  }
  const metaNames = new Set(meta.map((m) => foldText(m.name)))
  const targetNames = new Set(targets.map((t) => foldText(t.name)))
  const rating = Number(settings.rating) || 99
  const promoRating = Number(settings.promoRating) || 99

  return (card) => {
    const def = defIdOf(card)
    if (def != null && inEa.has(def)) return `In your squad “${inEa.get(def)}”`
    if (inSaved.has(playerKey(card))) return `In saved squad “${inSaved.get(playerKey(card))}”`
    const names = namesOf(card)
    if (names.some((n) => metaNames.has(n))) return 'On your Meta list'
    if (names.some((n) => targetNames.has(n))) return 'On your Squad targets'
    if (card.rating >= rating) return `Rated ${rating}+`
    if (card.custom && card.rating >= promoRating) return `Promo card rated ${promoRating}+`
    return null
  }
}
