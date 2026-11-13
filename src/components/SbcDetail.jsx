import { useMemo, useState } from 'react'
import { describePlan, keptFor, solveSbc } from '../lib/solver.js'
import KeepSettings from './KeepSettings.jsx'

const fmt = (n) => Math.round(n).toLocaleString()
const tierFor = (r) => (r >= 75 ? 'gold' : r >= 65 ? 'silver' : 'bronze')

function timeLeft(expires) {
  if (!expires) return 'No expiry'
  const ms = new Date(`${expires}T23:59:59`).getTime() - Date.now()
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'Expired'
  const h = ms / 36e5
  return h < 24 ? `${Math.ceil(h)}h left` : `${Math.floor(h / 24)}d left`
}

function ClubTable({ rows, kind }) {
  return (
    <div className="table-wrap">
      <table className="detail-table">
        <thead>
          <tr>
            <th>OVR</th>
            <th>Player</th>
            <th>Card</th>
            <th className="num">{kind === 'score' ? 'Score' : 'Pos'}</th>
            <th className="num">Worth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.key}>
              <td><span className={`rating-badge tier-${p.card.tier}`}>{p.card.rating}</span></td>
              <td className="name-cell">{p.card.name}<span className="muted small">{[p.card.club, p.card.league].filter(Boolean).join(' · ')}</span></td>
              <td className="small">{p.card.custom ? p.card.version : 'Base'}{p.untradeable ? <span className="tag">untradeable</span> : null}</td>
              <td className="num">{kind === 'score' ? fmt(p.score) : p.card.position}</td>
              <td className="num">{p.untradeable ? '–' : `~${fmt(p.value)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SbcDetail({ sbc, clubCards, isKept, keep, onKeepChange, onUpdate }) {
  const [showKept, setShowKept] = useState(false)
  const plan = useMemo(() => solveSbc(sbc, clubCards, { isKept }), [sbc, clubCards, isKept])

  // Everything to buy across all squads, merged by what it is.
  const shopping = useMemo(() => {
    const m = new Map()
    for (const part of plan.parts) {
      for (const b of part.result.buy) {
        const what = b.label && b.label !== 'Any player' ? b.label : 'Any player'
        const k = `${what}|${b.rating}`
        const row = m.get(k) ?? { what, rating: b.rating, count: 0, price: b.price }
        row.count += b.count
        m.set(k, row)
      }
    }
    return [...m.values()].sort((a, b) => b.rating - a.rating)
  }, [plan])

  const kept = useMemo(() => {
    const seen = new Map()
    for (const part of plan.parts) for (const k of keptFor(part.text, clubCards, isKept)) seen.set(k.card.id, k)
    return [...seen.values()].sort((a, b) => b.card.rating - a.card.rating)
  }, [plan, clubCards, isKept])

  const many = plan.parts.length > 1
  const doneCount = sbc.requirements.filter((r) => r.done).length
  const toggleSquad = (i) => {
    const requirements = sbc.requirements.map((r, j) => (j === i ? { ...r, done: !r.done } : r))
    onUpdate({ requirements, status: requirements.every((r) => r.done) ? 'done' : 'doing' })
  }

  return (
    <div className="sbc-detail">
      <a className="back-link" href="#sbcs">← All SBCs</a>

      <header className="detail-head">
        <div>
          <h2>{sbc.name}</h2>
          <div className="tags">
            <span className="tag">{sbc.category}</span>
            {sbc.repeatable && <span className="tag">Repeatable</span>}
            <span className="tag">{timeLeft(sbc.expires)}</span>
            <span className="tag">{doneCount}/{sbc.requirements.length} squads done</span>
          </div>
        </div>
        {sbc.reward && (
          <div className="detail-reward">
            <span className="label">Reward</span>
            <strong>{sbc.reward}</strong>
          </div>
        )}
      </header>
      {sbc.notes && <p className="muted">{sbc.notes}</p>}

      <div className="detail-stats">
        <div><span className="label">Coins to spend</span><strong>{plan.buyCost ? fmt(plan.buyCost) : '0'}</strong></div>
        <div><span className="label">Players to buy</span><strong>{plan.buyCount}</strong></div>
        <div><span className="label">From your club</span><strong>{plan.clubCount}</strong>{plan.clubValue > 0 && <small className="muted">worth ~{fmt(plan.clubValue)}</small>}</div>
        <div><span className="label">Kept out</span><strong>{kept.length}</strong><small className="muted">squad & good cards</small></div>
      </div>

      <KeepSettings keep={keep} onChange={onKeepChange} />

      {!plan.parts.length && <p className="empty">Every squad in this SBC is done.</p>}

      {shopping.length > 0 && (
        <section className="detail-section">
          <h3>What to buy</h3>
          <div className="table-wrap">
            <table className="detail-table">
              <thead>
                <tr><th>OVR</th><th>What</th><th className="num">Qty</th><th className="num">Each</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {shopping.map((b, i) => (
                  <tr key={i}>
                    <td><span className={`rating-badge tier-${tierFor(b.rating)}`}>{b.rating}</span></td>
                    <td>{b.what === 'Any player' ? `Any ${b.rating}-rated ${tierFor(b.rating)} player` : b.what}<span className="muted small">Cheapest base card you can find</span></td>
                    <td className="num">{b.count}</td>
                    <td className="num">~{fmt(b.price)}</td>
                    <td className="num"><strong>{fmt(b.price * b.count)}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4}>Estimated total</td><td className="num"><strong>{fmt(plan.buyCost)}</strong></td></tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {plan.parts.map((part) => {
        const r = part.result
        return (
          <section key={part.index} className="detail-section">
            <div className="section-head">
              <h3>{many ? part.text.split(' · ')[0] : 'How to complete it'}</h3>
              <label className="check small">
                <input type="checkbox" checked={!!sbc.requirements[part.index]?.done} onChange={() => toggleSquad(part.index)} />
                Done
              </label>
            </div>
            <p className="plan-text">{describePlan(part.text, r)}</p>
            {r.checks.length > 0 && (
              <ul className="req-checks">
                {r.checks.map((c, i) => (
                  <li key={i} className={c.ok === true ? 'pass' : c.ok === false ? 'fail' : 'unknown'}>
                    <span className="req-icon" aria-hidden="true">{c.ok === true ? '✓' : c.ok === false ? '✗' : '?'}</span>
                    <span>{c.text}</span>
                    {c.detail && <span className="muted small">{c.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
            {r.club.length > 0 ? (
              <>
                <h4>In your club ({r.club.length}){r.kind === 'score' ? ` · ${fmt(r.clubScore)} score` : ''}</h4>
                <ClubTable rows={[...r.club].sort((a, b) => b.card.rating - a.card.rating)} kind={r.kind} />
              </>
            ) : (
              <p className="muted small">None of your free club players fit this squad.</p>
            )}
          </section>
        )
      })}

      {kept.length > 0 && (
        <section className="detail-section">
          <div className="section-head">
            <h3>Kept out of this plan ({kept.length})</h3>
            <button type="button" className="link" onClick={() => setShowKept((v) => !v)}>{showKept ? 'Hide' : 'Show'}</button>
          </div>
          <p className="muted small">These club players would fit, but they’re in your squads or count as good cards.</p>
          {showKept && (
            <ul className="kept-list">
              {kept.map(({ card, reason }) => (
                <li key={card.id}>
                  <span className={`rating-badge tier-${card.tier}`}>{card.rating}</span>
                  <span className="plan-name"><span>{card.name}</span><span className="muted small">{card.custom ? card.version : 'Base'}</span></span>
                  <span className="muted small">{reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
