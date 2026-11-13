import { useMemo, useState } from 'react'
import { newId } from '../lib/collection.js'
import { solveSbc } from '../lib/solver.js'
import KeepSettings from './KeepSettings.jsx'

const fmt = (n) => Math.round(n).toLocaleString()

const CATEGORIES = ['Players', 'Icons', 'Heroes', 'Upgrades', 'Foundations', 'Challenges', 'Other']
const STATUSES = [
  ['todo', 'To do'],
  ['doing', 'In progress'],
  ['done', 'Done'],
  ['skipped', 'Skipped'],
]
const EMPTY = { name: '', category: 'Players', reward: '', expires: '', cost: '', repeatable: false, requirements: '', notes: '' }

// "3d left", "5h left", "Expired" — null when there is no expiry date.
function timeLeft(expires) {
  if (!expires) return null
  const end = new Date(`${expires}T23:59:59`)
  const ms = end.getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return { text: 'Expired', level: 'expired' }
  const hours = ms / 36e5
  if (hours < 24) return { text: `${Math.ceil(hours)}h left`, level: 'urgent' }
  const days = Math.floor(hours / 24)
  return { text: `${days}d left`, level: days <= 2 ? 'soon' : 'ok' }
}

const coins = (n) => (Number(n) ? `${Number(n).toLocaleString()} coins` : '')

export default function Sbcs({ sbcs, onChange, clubCards = [], isKept, keep, onKeepChange }) {
  const [form, setForm] = useState(EMPTY)
  const [adding, setAdding] = useState(false)
  const [show, setShow] = useState('open')

  // Plan every open SBC against your club.
  const plans = useMemo(() => {
    const map = new Map()
    const todo = sbcs.filter((s) => s.status !== 'done' && s.status !== 'skipped' && s.requirements.some((r) => !r.done))
    for (const s of todo) map.set(s.id, solveSbc(s, clubCards, { isKept }))
    // Doing all of them: hand out club players in order of expiry, so none is counted twice.
    const used = new Set()
    let all = 0
    for (const s of [...todo].sort((a, b) => String(a.expires || '9999').localeCompare(String(b.expires || '9999')))) {
      all += Number(s.cost) > 0 ? Number(s.cost) : solveSbc(s, clubCards, { isKept, used }).buyCost
    }
    map.total = all
    return map
  }, [sbcs, clubCards, isKept])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const update = (id, patch) => onChange(sbcs.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const remove = (s) => window.confirm(`Delete the "${s.name}" SBC?`) && onChange(sbcs.filter((x) => x.id !== s.id))

  function add(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    const requirements = form.requirements
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ text, done: false }))
    onChange([
      { ...form, id: newId(), name: form.name.trim(), cost: Number(form.cost) || 0, requirements, status: 'todo', addedAt: new Date().toISOString() },
      ...sbcs,
    ])
    setForm(EMPTY)
    setAdding(false)
  }

  const open = sbcs.filter((s) => s.status !== 'done' && s.status !== 'skipped')
  const list = (show === 'open' ? open : sbcs).slice().sort((a, b) => {
    const order = { doing: 0, todo: 1, done: 2, skipped: 3 }
    return (order[a.status] ?? 1) - (order[b.status] ?? 1) || String(a.expires || '9999').localeCompare(String(b.expires || '9999'))
  })
  const costLeft = plans.total ?? 0

  return (
    <div className="planner">
      <div className="planner-bar">
        <div className="summary">
          <span><strong>{open.length}</strong> open</span>
          <span><strong>{sbcs.filter((s) => s.status === 'done').length}</strong> done</span>
          {costLeft > 0 && <span title="Club players are shared out across SBCs in order of expiry, so none is counted twice.">~<strong>{costLeft.toLocaleString()}</strong> coins to finish them all</span>}
        </div>
        <div className="segmented" role="radiogroup" aria-label="Show">
          {[['open', 'Open'], ['all', 'All']].map(([v, t]) => (
            <button key={v} type="button" role="radio" aria-checked={show === v} className={show === v ? 'active' : ''} onClick={() => setShow(v)}>{t}</button>
          ))}
        </div>
        <button type="button" className="primary" onClick={() => setAdding((a) => !a)}>{adding ? 'Cancel' : 'Add SBC'}</button>
      </div>

      <KeepSettings keep={keep} onChange={onKeepChange} />

      {adding && (
        <form className="entry-form" onSubmit={add}>
          <label>Name<input id="sbc-name" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Showdown Schertenleib" /></label>
          <label>Type<select id="sbc-cat" value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Reward<input id="sbc-reward" value={form.reward} onChange={(e) => set('reward', e.target.value)} placeholder="e.g. 89 CM player, 85+ x10 pack" /></label>
          <label>Expires<input id="sbc-expires" type="date" value={form.expires} onChange={(e) => set('expires', e.target.value)} /></label>
          <label>Est. cost (coins)<input id="sbc-cost" type="number" min="0" step="1000" value={form.cost} onChange={(e) => set('cost', e.target.value)} /></label>
          <label className="check"><input id="sbc-repeat" type="checkbox" checked={form.repeatable} onChange={(e) => set('repeatable', e.target.checked)} />Repeatable</label>
          <label className="wide">Squads / requirements (one per line)<textarea id="sbc-reqs" rows="3" value={form.requirements} onChange={(e) => set('requirements', e.target.value)} placeholder={'86-rated squad\nTOTW + 85-rated squad'} /></label>
          <label className="wide">Notes<input id="sbc-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Fodder to use, is it worth it…" /></label>
          <button type="submit" className="primary">Save SBC</button>
        </form>
      )}

      {!list.length ? (
        <p className="empty">{sbcs.length ? 'Every SBC is done. Nice.' : 'No SBCs tracked yet. Use “Add SBC” to log one you want to complete.'}</p>
      ) : (
        <div className="entries">
          {list.map((s) => {
            const left = timeLeft(s.expires)
            const reqDone = s.requirements.filter((r) => r.done).length
            return (
              <article key={s.id} className={`entry status-${s.status}`}>
                <header>
                  <div className="entry-title">
                    <h3><a href={`#sbc-${s.id}`}>{s.name}</a></h3>
                    <div className="tags">
                      <span className="tag">{s.category}</span>
                      {s.repeatable && <span className="tag">Repeatable</span>}
                      {left && <span className={`tag time-${left.level}`}>{left.text}</span>}
                    </div>
                  </div>
                  <select aria-label={`Status of ${s.name}`} value={s.status} onChange={(e) => update(s.id, { status: e.target.value })}>
                    {STATUSES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </header>
                {(s.reward || Number(s.cost) > 0) && (
                  <p className="entry-line">
                    {s.reward && <span><span className="label">Reward</span> {s.reward}</span>}
                    {coins(s.cost) && <span><span className="label">Cost</span> {coins(s.cost)}</span>}
                  </p>
                )}
                {s.requirements.length > 0 && (
                  <div className="reqs">
                    <div className="label">Squads {reqDone}/{s.requirements.length}</div>
                    <ul>
                      {s.requirements.map((r, i) => (
                        <li key={i}>
                          <label>
                            <input
                              type="checkbox"
                              checked={r.done}
                              onChange={() => {
                                const requirements = s.requirements.map((x, j) => (j === i ? { ...x, done: !x.done } : x))
                                const all = requirements.every((x) => x.done)
                                update(s.id, { requirements, status: all ? 'done' : s.status === 'todo' ? 'doing' : s.status === 'done' ? 'doing' : s.status })
                              }}
                            />
                            <span>{r.text}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.notes && <p className="entry-notes">{s.notes}</p>}
                {plans.has(s.id) && (
                  <a className="plan-link" href={`#sbc-${s.id}`}>
                    <span>
                      <span className="label">Est. cost</span>{' '}
                      <strong>{plans.get(s.id).buyCost ? `${fmt(plans.get(s.id).buyCost)} coins` : 'Covered by your club'}</strong>
                    </span>
                    <span className="muted small">
                      {plans.get(s.id).clubCount} from club · {plans.get(s.id).buyCount} to buy · View plan →
                    </span>
                  </a>
                )}
                <footer><button type="button" className="link danger" onClick={() => remove(s)}>Delete</button></footer>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
