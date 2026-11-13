import { useState } from 'react'
import { POSITION_GROUPS, foldText } from '../lib/cards.js'
import { newId } from '../lib/collection.js'

const TIERS = [
  ['S', 'Game-changers'],
  ['A', 'Strong picks'],
  ['B', 'Budget / situational'],
]
const SOURCES = ['SBC', 'Packs / market', 'Objective', 'Evolution', 'Reward']
const EMPTY = { name: '', version: '', rating: '', position: '', tier: 'A', source: 'Packs / market', price: '', playstyles: '', notes: '', link: '' }

const groupOf = (pos) => Object.keys(POSITION_GROUPS).find((g) => POSITION_GROUPS[g].includes(pos)) ?? 'ATT'

export default function Meta({ meta, targets, ownedNames, onChange, onTarget }) {
  const [form, setForm] = useState(EMPTY)
  const [adding, setAdding] = useState(false)
  const [pos, setPos] = useState('all')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const update = (id, patch) => onChange(meta.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  const remove = (m) => window.confirm(`Remove ${m.name} from the meta list?`) && onChange(meta.filter((x) => x.id !== m.id))

  function add(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onChange([
      { ...form, id: newId(), name: form.name.trim(), rating: Number(form.rating) || null, price: Number(form.price) || 0, position: form.position.toUpperCase(), addedAt: new Date().toISOString() },
      ...meta,
    ])
    setForm(EMPTY)
    setAdding(false)
  }

  const targetNames = new Set(targets.map((t) => foldText(`${t.name}|${t.version ?? ''}`)))
  const visible = meta.filter((m) => pos === 'all' || groupOf(m.position) === pos)

  return (
    <div className="planner">
      <div className="planner-bar">
        <div className="segmented" role="radiogroup" aria-label="Position">
          {[['all', 'All'], ...Object.keys(POSITION_GROUPS).map((g) => [g, g])].map(([v, t]) => (
            <button key={v} type="button" role="radio" aria-checked={pos === v} className={pos === v ? 'active' : ''} onClick={() => setPos(v)}>{t}</button>
          ))}
        </div>
        <button type="button" className="primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : 'Add meta card'}</button>
      </div>

      {adding && (
        <form className="entry-form" onSubmit={add}>
          <label>Player<input id="m-name" required value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label>Card version<input id="m-version" value={form.version} onChange={(e) => set('version', e.target.value)} placeholder="e.g. POTM LaLiga" /></label>
          <label>Rating<input id="m-rating" type="number" min="40" max="99" value={form.rating} onChange={(e) => set('rating', e.target.value)} /></label>
          <label>Position<input id="m-pos" value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="CAM" maxLength={4} /></label>
          <label>Tier<select id="m-tier" value={form.tier} onChange={(e) => set('tier', e.target.value)}>{TIERS.map(([v, t]) => <option key={v} value={v}>{v}: {t}</option>)}</select></label>
          <label>How to get<select id="m-source" value={form.source} onChange={(e) => set('source', e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Price (coins)<input id="m-price" type="number" min="0" step="1000" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
          <label>PlayStyles+<input id="m-ps" value={form.playstyles} onChange={(e) => set('playstyles', e.target.value)} placeholder="Rapid+, Finesse Shot" /></label>
          <label className="wide">Why it's meta<input id="m-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></label>
          <label className="wide">Source link<input id="m-link" type="url" value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" /></label>
          <button type="submit" className="primary">Save card</button>
        </form>
      )}

      {!visible.length ? (
        <p className="empty">{meta.length ? 'No meta cards at this position.' : 'No meta cards yet. Add the cards everyone is using.'}</p>
      ) : (
        TIERS.map(([tier, label]) => {
          const cards = visible.filter((m) => (m.tier ?? 'A') === tier).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
          if (!cards.length) return null
          return (
            <section key={tier} className="meta-tier">
              <h2><span className={`tier-mark tier-${tier}`}>{tier}</span> {label}</h2>
              <div className="meta-grid">
                {cards.map((m) => {
                  const inClub = ownedNames.has(foldText(m.name))
                  const targeted = targetNames.has(foldText(`${m.name}|${m.version ?? ''}`))
                  return (
                    <article key={m.id} className="meta-card">
                      <header>
                        <span className="rating-badge tier-special">{m.rating ?? '?'}</span>
                        <div className="meta-name">
                          <strong>{m.name}</strong>
                          <span className="muted small">{[m.position, m.version].filter(Boolean).join(' · ')}</span>
                        </div>
                        <select aria-label={`Tier of ${m.name}`} value={m.tier ?? 'A'} onChange={(e) => update(m.id, { tier: e.target.value })}>
                          {TIERS.map(([v]) => <option key={v}>{v}</option>)}
                        </select>
                      </header>
                      <div className="tags">
                        {m.source && <span className="tag">{m.source}</span>}
                        {Number(m.price) > 0 && <span className="tag">{Number(m.price).toLocaleString()} coins</span>}
                        {inClub && <span className="tag owned">In club</span>}
                      </div>
                      {m.playstyles && <p className="small"><span className="label">PlayStyles</span> {m.playstyles}</p>}
                      {m.notes && <p className="entry-notes">{m.notes}</p>}
                      <footer>
                        <button type="button" className="secondary" disabled={targeted} onClick={() => onTarget(m)}>
                          {targeted ? 'In targets' : 'Add to targets'}
                        </button>
                        {m.link && <a href={m.link} target="_blank" rel="noreferrer">Source</a>}
                        <button type="button" className="link danger" onClick={() => remove(m)}>Remove</button>
                      </footer>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
