import { tierOf } from '../lib/cards.js'

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function resolvePull(pull, lookup) {
  const card = pull.id != null ? lookup.get(String(pull.id)) : null
  const rating = pull.rating ?? card?.rating ?? null
  return {
    name: pull.name ?? card?.name ?? `Unknown card #${pull.id}`,
    rating,
    version: pull.version ?? card?.version ?? (card ? 'Base' : ''),
    tier: card?.tier ?? (pull.version && pull.version !== 'Base' ? 'special' : rating != null ? tierOf(rating) : 'bronze'),
  }
}

export default function Packs({ packs, lookup }) {
  if (!packs.length) {
    return (
      <p className="empty">
        No packs logged yet. Add them to <code>packs</code> in <code>data/my-collection.json</code>.
      </p>
    )
  }
  const sorted = [...packs].sort((a, b) => String(b.openedAt ?? '').localeCompare(String(a.openedAt ?? '')))
  return (
    <div className="packs">
      {sorted.map((pack, i) => (
        <section className="pack" key={pack.id ?? i}>
          <header>
            <h3>{pack.name ?? 'Pack'}</h3>
            <time dateTime={pack.openedAt}>{formatDate(pack.openedAt)}</time>
          </header>
          {pack.note && <p className="pack-note">{pack.note}</p>}
          <ul>
            {(pack.pulls ?? []).map((pull, j) => {
              const p = resolvePull(pull, lookup)
              return (
                <li key={j}>
                  <span className={`rating-badge tier-${p.tier}`}>{p.rating ?? '?'}</span>
                  <span className="pull-name">{p.name}</span>
                  {p.version && <span className="pull-version">{p.version}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
