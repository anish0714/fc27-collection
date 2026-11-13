export const TIERS = ['gold', 'silver', 'bronze', 'special']

export const POSITION_GROUPS = {
  GK: ['GK'],
  DEF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MID: ['CDM', 'CM', 'CAM', 'LM', 'RM'],
  ATT: ['ST', 'CF', 'LW', 'RW'],
}

const OUTFIELD_LABELS = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']
const GK_LABELS = ['DIV', 'HAN', 'KIC', 'REF', 'SPE', 'POS']
const STAT_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy']

// EA stores GK face stats in the same pac..phy slots, in DIV/HAN/KIC/REF/SPE/POS order.
export function statRows(card) {
  const labels = card.position === 'GK' ? GK_LABELS : OUTFIELD_LABELS
  const stats = card.stats ?? {}
  return STAT_KEYS.map((key, i) => {
    const value = stats[key] ?? stats[labels[i].toLowerCase()]
    return { label: labels[i], value: value ?? '–' }
  })
}

export const tierOf = (rating) => (rating >= 75 ? 'gold' : rating >= 65 ? 'silver' : 'bronze')

export const foldText = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts.at(-1)[0]).toUpperCase()
}

// Turns a customCards entry into the same shape as an EA card.
export function toCustomCard(c) {
  return {
    id: String(c.id),
    name: c.name ?? 'Unknown',
    rating: Number(c.rating) || 0,
    tier: 'special',
    version: c.version ?? 'Special',
    position: c.position ?? '',
    altPositions: c.altPositions ?? [],
    club: c.club ?? '',
    clubImg: c.clubImg ?? '',
    nation: c.nation ?? '',
    nationImg: c.nationImg ?? '',
    league: c.league ?? '',
    gender: c.gender === 'W' ? 'W' : 'M',
    img: c.img ?? '',
    stats: c.stats ?? {},
    custom: true,
  }
}
