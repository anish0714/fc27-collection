// Meta team templates (data/meta-teams.json) matched against real cards and your club.
import metaTeams from '../../data/meta-teams.json'
import { foldText } from './cards.js'
import { canPlay, playerKey, slotsOf } from './squad.js'

export const META_TEAMS = metaTeams.teams
export const META_TEAMS_INFO = { updatedAt: metaTeams.updatedAt, sources: metaTeams.sources, note: metaTeams.note }

// Does this card belong to the named player? Handles "Patri Guijarro" vs "Patricia Guijarro".
function matches(card, name) {
  const n = foldText(name).trim()
  if (foldText(card.name) === n) return true
  const first = foldText(card.firstName ?? '')
  const last = foldText(card.lastName ?? '')
  if (first && last && `${first} ${last}` === n) return true
  const tokens = n.split(/\s+/)
  if (tokens.length < 2) return false
  const lastTok = tokens.at(-1)
  const nameTokens = foldText(card.name).split(/\s+/)
  const lastOk = nameTokens.at(-1) === lastTok || last.split(/\s+/).includes(lastTok)
  const firstOk = (first || nameTokens[0]).startsWith(tokens[0]) || nameTokens[0] === tokens[0]
  return lastOk && firstOk
}

const best = (cards, pos) => [...cards].sort((a, b) => canPlay(b, pos) - canPlay(a, pos) || b.rating - a.rating)[0]

// For each slot: the role, the named players, and the card to use
// (your best owned version if you have one, otherwise the best card of the first named player).
export function resolveTeam(team, allCards, ownedCards) {
  const slots = slotsOf(team.formation)
  const used = new Set()
  const free = (c) => !used.has(playerKey(c))
  return slots.map((slot, i) => {
    const t = team.slots[i] ?? { role: '', players: [] }
    let pick = null
    let owned = false
    let pickName = t.players[0] ?? ''
    for (const name of t.players) {
      const mine = ownedCards.filter((c) => free(c) && matches(c, name))
      if (mine.length) {
        pick = best(mine, slot.pos)
        owned = true
        pickName = name
        break
      }
    }
    if (!pick) {
      for (const name of t.players) {
        const any = allCards.filter((c) => free(c) && matches(c, name))
        if (any.length) {
          pick = best(any, slot.pos)
          pickName = name
          break
        }
      }
    }
    if (pick) used.add(playerKey(pick))
    return { pos: slot.pos, role: t.role, players: t.players, pickName, pick, owned }
  })
}
