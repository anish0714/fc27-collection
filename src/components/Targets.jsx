import { useState } from 'react'
import { foldText } from '../lib/cards.js'
import { newId } from '../lib/collection.js'

const PRIORITIES = [
  ['high', 'Must have'],
  ['med', 'Nice to have'],
  ['low', 'Later'],
]
const EMPTY = { name: '', version: '', rating: '', position: '', price: '', priority: 'high', replaces: '', why: '' }

export default function Targets({ targets, ownedNames, onChange }) {
  const [form, setForm] = useState(EMPTY)
  const [adding, setAdding] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const update = (id, patch) => onChange(targets.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const remove = (t) => window.confirm(`Remove ${t.name} from your targets?`) && onChange(targets.filter((x) => x.id !== t.id))

  function add(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onChange([
      { ...form, id: newId(), name: form.name.trim(), rating: Number(form.rating) || null, price: Number(form.price) || 0, position: form.position.toUpperCase(), status: 'want', addedAt: new Date().toISOString() },
      ...targets,
    ])
    setForm(EMPTY)
    setAdding(false)
  }

  const rank = { high: 0, med: 1, low: 2 }
  const sorted = targets.slice().sort((a, b) => (a.status === 'got') - (b.status === 'got') || (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || (b.rating ?? 0) - (a.rating ?? 0))
  const wanted = targets.filter((t) => t.status !== 'got')
  const budget = wanted.reduce((n, t) => n + (Number(t.price) || 0), 0)

  return (
    <div className="planner">
      <div className="planner-bar">
        <div className="summary">
          <span><strong>{wanted.length}</strong> to get</span>
          <span><strong>{targets.length - wanted.length}</strong> got</span>
          {budget > 0 && <span><strong>{budget.toLocaleString()}</strong> coins needed</span>}
        </div>
        <button type="button" className="primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : 'Add target'}</button>
      </div>

      {adding && (
        <form className="entry-form" onSubmit={add}>
          <label>Player<input id="t-name" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Brian Brobbey" /></label>
          <label>Card version<input id="t-version" value={form.version} onChange={(e) => set('version', e.target.value)} placeholder="e.g. UEL RTTK" /></label>
          <label>Rating<input id="t-rating" type="number" min="40" max="99" value={form.rating} onChange={(e) => set('rating', e.target.value)} /></label>
          <label>Position<input id="t-pos" value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="ST" maxLength={4} /></label>
          <label>Price (coins)<input id="t-price" type="number" min="0" step="1000" value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
          <label>Priority<select id="t-priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>{PRIORITIES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
          <label>Replaces<input id="t-replaces" value={form.replaces} onChange={(e) => set('replaces', e.target.value)} placeholder="Who leaves the XI" /></label>
          <label className="wide">Why<input id="t-why" value={form.why} onChange={(e) => set('why', e.target.value)} placeholder="Links with my PL midfield, Rapid+ on the wing…" /></label>
          <button type="submit" className="primary">Save target</button>
        </form>
      )}

      {!sorted.length ? (
        <p className="empty">No targets yet. Add cards that would improve your squad, or add them from the Meta tab.</p>
      ) : (
        <div className="target-list">
          {sorted.map((t) => {
            const inClub = ownedNames.has(foldText(t.name))
            return (
              <article key={t.id} className={`target ${t.status === 'got' ? 'got' : ''}`}>
                <span className="rating-badge tier-special">{t.rating ?? '?'}</span>
                <div className="target-main">
                  <div className="target-name">
                    <strong>{t.name}</strong>
                    {t.position && <span className="tag">{t.position}</span>}
                    {t.version && <span className="muted">{t.version}</span>}
                    {inClub && t.status !== 'got' && <span className="tag owned" title="A card of this player is already in your club">In club</span>}
                  </div>
                  {(t.why || t.replaces) && (
                    <div className="muted small">
                      {t.replaces && <>Replaces {t.replaces}. </>}
                      {t.why}
                    </div>
                  )}
                </div>
                <div className="target-side">
                  {Number(t.price) > 0 && <span className="price">{Number(t.price).toLocaleString()}</span>}
                  <select aria-label={`Priority of ${t.name}`} value={t.priority} onChange={(e) => update(t.id, { priority: e.target.value })}>
                    {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <label className="got-toggle">
                    <input type="checkbox" checked={t.status === 'got'} onChange={(e) => update(t.id, { status: e.target.checked ? 'got' : 'want' })} />
                    Got it
                  </label>
                  <button type="button" className="link danger" onClick={() => remove(t)} aria-label={`Remove ${t.name}`}>Remove</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
