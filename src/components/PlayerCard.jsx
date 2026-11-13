import { memo, useState } from 'react'
import { initials, statRows } from '../lib/cards.js'

function Logo({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return (
    <img className="logo" src={src} alt={alt} title={alt} loading="lazy" onError={() => setFailed(true)} />
  )
}

function PlayerCard({ card, qty, editMode, onToggle }) {
  const [imgFailed, setImgFailed] = useState(false)
  const owned = qty > 0
  const clickable = editMode && !card.custom
  const className = ['fut-card', `tier-${card.tier}`, owned ? 'owned' : 'missing', clickable && 'clickable']
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <div className="fut-top">
        <span className="fut-rating">{card.rating}</span>
        <span className="fut-pos">{card.position}</span>
      </div>
      <div className="fut-face">
        {card.img && !imgFailed ? (
          <img src={card.img} alt="" loading="lazy" decoding="async" onError={() => setImgFailed(true)} />
        ) : (
          <span className="fut-initials">{initials(card.name)}</span>
        )}
      </div>
      <div className="fut-name" title={card.name}>{card.name}</div>
      {card.version && <div className="fut-version">{card.version}</div>}
      <dl className="fut-stats">
        {statRows(card).map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="fut-logos">
        <Logo src={card.nationImg} alt={card.nation} />
        <Logo src={card.clubImg} alt={card.club} />
      </div>
      {owned && (
        <span className="owned-badge" aria-label={`Owned${qty > 1 ? ` ×${qty}` : ''}`}>
          ✓{qty > 1 && <small>×{qty}</small>}
        </span>
      )}
    </>
  )

  const label = `${card.name}, ${card.rating} ${card.position}, ${owned ? 'owned' : 'missing'}`
  return clickable ? (
    <button type="button" className={className} onClick={() => onToggle(card.id)} aria-pressed={owned} aria-label={label}>
      {content}
    </button>
  ) : (
    <article className={className} aria-label={label}>
      {content}
    </article>
  )
}

export default memo(PlayerCard)
