import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { foldText, initials } from '../lib/cards.js'
import { newId } from '../lib/collection.js'
import { META_TEAMS } from '../lib/metaTeams.js'
import { FORMATIONS, autoBuild, canPlay, chemistry, checkRequirement, playerKey, requirementParts, slotsOf, teamRating } from '../lib/squad.js'

const DRAFT_KEY = 'fc27-squad-draft'
const MODES = [
  ['rating', 'Highest rating'],
  ['balanced', 'Balanced'],
  ['chemistry', 'Max chemistry'],
]

function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
    if (d && FORMATIONS[d.formation] && Array.isArray(d.ids) && d.ids.length === 11) return d
  } catch {
    // no storage: start empty
  }
  return { formation: '4-3-3', ids: Array(11).fill(null), name: '' }
}

function ChemDots({ value }) {
  return (
    <span className="chem-dots" aria-label={`${value} chemistry`}>
      {[0, 1, 2].map((i) => <i key={i} className={i < value ? 'on' : ''} />)}
    </span>
  )
}

function SlotCard({ slot, card, chem, selected, locked, onClick, role }) {
  const outOfPos = card && !canPlay(card, slot.pos)
  return (
    <button
      type="button"
      className={`slot ${card ? `filled tier-${card.tier}` : 'empty'} ${selected ? 'selected' : ''}`}
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
      onClick={onClick}
      title={role ? `${slot.pos}: ${role}` : undefined}
      aria-label={card ? `${slot.pos}: ${card.name}, ${card.rating}, ${chem} chemistry` : `Empty ${slot.pos} slot`}
      aria-pressed={selected}
    >
      {card ? (
        <>
          <span className="slot-rating">{card.rating}</span>
          <span className="slot-face">
            {card.img ? <img src={card.img} alt="" loading="lazy" /> : <span>{initials(card.name)}</span>}
          </span>
          <span className="slot-name">{card.name.length <= 12 ? card.name : card.name.split(' ').at(-1)}</span>
          <ChemDots value={chem ?? 0} />
          {locked && <span className="slot-lock" aria-hidden="true">🔒</span>}
        </>
      ) : (
        <span className="slot-plus" aria-hidden="true">+</span>
      )}
      <span className={`slot-pos ${outOfPos ? 'wrong' : ''}`}>{slot.pos}</span>
    </button>
  )
}

export default function SquadBuilder({ allCards, ownedCards, ownedKeys, lookup, sbcs, squads, onSquadsChange }) {
  const [draft, setDraft] = useState(readDraft)
  const [selected, setSelected] = useState(null)
  const [locked, setLocked] = useState(() => new Set())
  const [mode, setMode] = useState('balanced')
  const [source, setSource] = useState('club')
  const [query, setQuery] = useState('')
  const [anyPos, setAnyPos] = useState(false)
  const [sbcId, setSbcId] = useState('')
  const [reqIndex, setReqIndex] = useState(0)
  const [message, setMessage] = useState('')
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // ignore
    }
  }, [draft])

  const slots = useMemo(() => slotsOf(draft.formation), [draft.formation])
  const cards = useMemo(() => draft.ids.map((id) => (id == null ? null : lookup.get(String(id)) ?? null)), [draft.ids, lookup])
  const chem = useMemo(() => chemistry(slots, cards), [slots, cards])
  const rating = useMemo(() => teamRating(cards), [cards])
  const filled = cards.filter(Boolean).length
  const value = cards.reduce((n, c) => n + (c?.rating ?? 0), 0)

  const setIds = (ids) => setDraft((d) => ({ ...d, ids }))
  const setSlot = (i, card) => setIds(draft.ids.map((id, j) => (j === i ? (card ? card.id : null) : id)))

  // ----- picker -----
  const pickerPos = selected != null ? slots[selected].pos : null
  const inSquad = useMemo(() => new Map(cards.map((c, i) => [c && playerKey(c), i]).filter(([k]) => k)), [cards])
  const candidates = useMemo(() => {
    if (selected == null) return []
    const pool = source === 'club' ? ownedCards : allCards
    const terms = foldText(deferredQuery).trim().split(/\s+/).filter(Boolean)
    return pool
      .filter((c) => (anyPos || canPlay(c, pickerPos)) && terms.every((t) => (c._q ?? foldText(c.name)).includes(t)))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 80)
  }, [selected, source, ownedCards, allCards, deferredQuery, anyPos, pickerPos])

  function pick(card) {
    const other = inSquad.get(playerKey(card))
    const ids = [...draft.ids]
    if (other != null && other !== selected) ids[other] = draft.ids[selected] // swap the two slots
    ids[selected] = card.id
    setIds(ids)
    setSelected(null)
    setQuery('')
  }

  function toggleLock(i) {
    setLocked((s) => {
      const next = new Set(s)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function runAutoBuild() {
    const pool = ownedCards
    const built = autoBuild(slots, pool, cards, locked, mode)
    setIds(built.map((c) => (c ? c.id : null)))
    const missing = built.filter((c) => !c).length
    setMessage(missing ? `Built from your club. ${missing} slot${missing > 1 ? 's' : ''} had no player who can play there.` : 'Built from your club.')
  }

  function clearSquad() {
    setIds(draft.ids.map((id, i) => (locked.has(i) ? id : null)))
    setMessage('')
  }

  // ----- saved squads -----
  function saveSquad() {
    const name = draft.name.trim() || `Squad ${squads.length + 1}`
    const existing = squads.find((s) => foldText(s.name) === foldText(name))
    const entry = { id: existing?.id ?? newId(), name, formation: draft.formation, ids: draft.ids, rating, chem: chem.total, updatedAt: new Date().toISOString() }
    onSquadsChange(existing ? squads.map((s) => (s.id === existing.id ? entry : s)) : [entry, ...squads])
    setDraft((d) => ({ ...d, name }))
    setMessage(existing ? `Updated “${name}”.` : `Saved “${name}”.`)
  }

  function loadSquad(s) {
    setDraft({ formation: FORMATIONS[s.formation] ? s.formation : '4-3-3', ids: s.ids.slice(0, 11).concat(Array(11).fill(null)).slice(0, 11), name: s.name })
    setLocked(new Set())
    setSelected(null)
    setMessage(`Loaded “${s.name}”.`)
  }

  // ----- SBC check -----
  const sbcOptions = sbcs.filter((s) => s.status !== 'done' && s.status !== 'skipped' && s.requirements.length)
  const sbc = sbcOptions.find((s) => s.id === sbcId)
  const reqLine = sbc?.requirements[Math.min(reqIndex, sbc.requirements.length - 1)]
  const checks = reqLine ? requirementParts(reqLine.text).map((t) => checkRequirement(t, cards, rating, chem.total)) : []

  const selectedCard = selected != null ? cards[selected] : null
  const metaTeam = draft.teamId ? META_TEAMS.find((t) => t.id === draft.teamId && t.formation === draft.formation) : null

  return (
    <div className="builder">
      <div className="pitch-wrap">
        <div className="squad-stats" aria-live="polite">
          <div><span className="label">Rating</span><strong>{rating || '–'}</strong></div>
          <div><span className="label">Chemistry</span><strong>{chem.total}<small>/33</small></strong></div>
          <div><span className="label">Players</span><strong>{filled}<small>/11</small></strong></div>
          <div><span className="label">Total OVR</span><strong>{value}</strong></div>
        </div>
        <div className="pitch">
          <div className="pitch-lines" aria-hidden="true">
            <span className="halfway" />
            <span className="circle" />
            <span className="box top" />
            <span className="box bottom" />
          </div>
          {slots.map((slot, i) => (
            <SlotCard
              key={i}
              slot={slot}
              card={cards[i]}
              chem={chem.perSlot[i]}
              selected={selected === i}
              locked={locked.has(i)}
              role={draft.roles?.[i]}
              onClick={() => setSelected(selected === i ? null : i)}
            />
          ))}
        </div>
      </div>

      <aside className="builder-side">
        {selected != null ? (
          <section className="side-panel picker">
            <header>
              <h3>
                {selectedCard ? `Replace ${selectedCard.name}` : `Pick a ${pickerPos}`}
                {draft.roles?.[selected] && <span className="muted small"> · {draft.roles[selected]}</span>}
              </h3>
              <button type="button" className="link" onClick={() => setSelected(null)}>Close</button>
            </header>
            {selectedCard && (
              <div className="picker-actions">
                <button type="button" className="secondary" onClick={() => toggleLock(selected)}>{locked.has(selected) ? 'Unlock' : 'Lock for auto-build'}</button>
                <button type="button" className="secondary" onClick={() => { setSlot(selected, null); setSelected(null) }}>Remove</button>
              </div>
            )}
            <input id="picker-search" type="search" className="search" placeholder="Search name, club, league, nation…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            <div className="picker-filters">
              <div className="segmented" role="radiogroup" aria-label="Players from">
                {[['club', 'My club'], ['all', 'All cards']].map(([v, t]) => (
                  <button key={v} type="button" role="radio" aria-checked={source === v} className={source === v ? 'active' : ''} onClick={() => setSource(v)}>{t}</button>
                ))}
              </div>
              <label className="check small"><input type="checkbox" checked={anyPos} onChange={(e) => setAnyPos(e.target.checked)} />Any position</label>
            </div>
            <ul className="picker-list">
              {candidates.map((c) => {
                const where = inSquad.get(playerKey(c))
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => pick(c)}>
                      <span className={`rating-badge tier-${c.tier}`}>{c.rating}</span>
                      <span className="pick-main">
                        <strong>{c.name}</strong>
                        <span className="muted small">{[c.club, c.league, c.nation].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="pick-side">
                        <span className="tag">{[c.position, ...(c.altPositions ?? [])].join(' ')}</span>
                        {c.custom && <span className="muted small">{c.version}</span>}
                        {where != null && <span className="tag">In squad</span>}
                        {source === 'all' && ownedKeys.has(playerKey(c)) && <span className="tag owned">In club</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
              {!candidates.length && <li className="muted small picker-empty">No players match. Try “Any position” or “All cards”.</li>}
            </ul>
          </section>
        ) : (
          <>
            <section className="side-panel">
              <label className="field">Formation
                <select id="formation" value={draft.formation} onChange={(e) => setDraft((d) => ({ ...d, formation: e.target.value, roles: undefined, teamId: undefined }))}>
                  {Object.keys(FORMATIONS).map((f) => <option key={f}>{f}</option>)}
                </select>
              </label>
              {metaTeam && (
                <div className="meta-team-note small">
                  <strong>{metaTeam.name}</strong>
                  <span className="muted">Build-up {metaTeam.tactics.buildUp} · Defensive line {metaTeam.tactics.defensiveLine}. Hover a player to see their role.</span>
                </div>
              )}
              <div className="field">
                <span>Auto-build from your club</span>
                <div className="segmented" role="radiogroup" aria-label="Auto-build goal">
                  {MODES.map(([v, t]) => (
                    <button key={v} type="button" role="radio" aria-checked={mode === v} className={mode === v ? 'active' : ''} onClick={() => setMode(v)}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="row-buttons">
                <button type="button" className="primary" onClick={runAutoBuild} disabled={!ownedCards.length}>Auto-build</button>
                <button type="button" className="secondary" onClick={clearSquad}>Clear</button>
              </div>
              <p className="muted small">
                Click a slot to pick a player. Locked players ({locked.size}) stay put when you auto-build.
                {!ownedCards.length && ' Import your club first to auto-build.'}
              </p>
              {message && <p className="small builder-msg">{message}</p>}
            </section>

            <section className="side-panel">
              <h3>Check against an SBC</h3>
              <label className="field">SBC
                <select id="sbc-check" value={sbcId} onChange={(e) => { setSbcId(e.target.value); setReqIndex(0) }}>
                  <option value="">None</option>
                  {sbcOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              {sbc && sbc.requirements.length > 1 && (
                <label className="field">Squad
                  <select id="sbc-squad" value={reqIndex} onChange={(e) => setReqIndex(Number(e.target.value))}>
                    {sbc.requirements.map((r, i) => <option key={i} value={i}>{r.text.split(' · ')[0].slice(0, 60)}</option>)}
                  </select>
                </label>
              )}
              {checks.length > 0 && (
                <ul className="req-checks">
                  {checks.map((c, i) => (
                    <li key={i} className={c.ok === true ? 'pass' : c.ok === false ? 'fail' : 'unknown'}>
                      <span className="req-icon" aria-hidden="true">{c.ok === true ? '✓' : c.ok === false ? '✗' : '?'}</span>
                      <span>{c.text}</span>
                      {c.detail && <span className="muted small">{c.detail}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {sbc && !checks.length && <p className="muted small">This SBC has no squad requirements to check.</p>}
            </section>

            <section className="side-panel">
              <h3>Saved squads</h3>
              <div className="row-buttons">
                <input id="squad-name" className="search" placeholder="Squad name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                <button type="button" className="primary" onClick={saveSquad} disabled={!filled}>Save</button>
              </div>
              {squads.length ? (
                <ul className="saved-list">
                  {squads.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="saved-load" onClick={() => loadSquad(s)}>
                        <strong>{s.name}</strong>
                        <span className="muted small">{s.formation} · {s.rating} rated · {s.chem} chem</span>
                      </button>
                      <button type="button" className="link danger" onClick={() => window.confirm(`Delete “${s.name}”?`) && onSquadsChange(squads.filter((x) => x.id !== s.id))}>Delete</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">No saved squads yet.</p>
              )}
            </section>
          </>
        )}
      </aside>
    </div>
  )
}
