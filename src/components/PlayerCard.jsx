import { memo, useState } from 'react'
import { initials, shieldOf, statRows } from '../lib/cards.js'

function Logo({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return null
  return (
    <img className="logo" src={src} alt={alt} title={alt} loading="lazy" onError={() => setFailed(true)} />
  )
}

// The app's own FC-style card, used for promo cards and when EA's card image is unavailable.
function DrawnCard({ card }) {
  const [imgFailed, setImgFailed] = useState(false)
  return (
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
      <div className="fut-name" title={card.name}>{card.lastName && card.name.length > 14 ? card.lastName : card.name}</div>
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
    </>
  )
}

function PlayerCard({ card, qty, editMode, onToggle, useEaImage = false }) {
  const shield = useEaImage ? shieldOf(card) : ''
  const [shieldFailed, setShieldFailed] = useState(false)
  const official = !!shield && !shieldFailed
  const owned = qty > 0
  const clickable = editMode && !card.custom
  const className = ['fut-card', official ? 'official' : `drawn tier-${card.tier}`, owned ? 'owned' : 'missing', clickable && 'clickable']
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {official ? (
        <img className="shield-img" src={shield} alt="" loading="lazy" decoding="async" onError={() => setShieldFailed(true)} />
      ) : (
        <DrawnCard card={card} />
      )}
      {owned && (
        <span className="owned-badge" aria-label={`Owned${qty > 1 ? ` ×${qty}` : ''}`}>
          ✓{qty > 1 && <small>×{qty}</small>}
        </span>
      )}
    </>
  )

  const label = `${card.name}, ${card.rating} ${card.position}${card.custom ? `, ${card.version}` : ''}, ${owned ? 'owned' : 'missing'}`
  return clickable ? (
    <button type="button" className={className} onClick={() => onToggle(card.id)} aria-pressed={owned} aria-label={label} title={card.name}>
      {content}
    </button>
  ) : (
    <article className={className} aria-label={label} title={card.name}>
      {content}
    </article>
  )
}

export default memo(PlayerCard)
