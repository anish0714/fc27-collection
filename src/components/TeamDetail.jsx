import { useMemo, useState } from 'react'
import { initials } from '../lib/cards.js'
import { META_TEAMS, META_TEAMS_INFO, resolveTeam } from '../lib/metaTeams.js'
import { chemistry, slotsOf, teamRating } from '../lib/squad.js'
import { buildInSquadBuilder } from './MetaTeams.jsx'

// What each build-up style means on the pitch.
const BUILD_UP = {
  Counter: 'Win the ball and go forward fast. Attackers sprint in behind as soon as you get possession.',
  'Short Passing': 'Players come short to receive. Keep the ball with quick, short passes until a gap opens.',
  Balanced: 'A mix of both: keeps shape on the ball and breaks quickly when there is space.',
  'Long Ball': 'Go direct over the top to quick or strong forwards.',
}

function lineLabel(v) {
  if (v < 40) return 'Deep'
  if (v <= 55) return 'Balanced'
  return 'High'
}

const splitRole = (role) => {
  const [name, focus] = String(role ?? '').split(' / ')
  return { name: name || role, focus: focus ?? '' }
}

// Player photo, falling back to initials when EA's image URL is missing or broken.
export function Face({ card }) {
  const [failed, setFailed] = useState(false)
  return card.img && !failed ? <img src={card.img} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span>{initials(card.name)}</span>
}

// Spread the formation (y 13 = striker … 92 = keeper) over 9–83% of the pitch,
// leaving room above the strikers and below the keeper for the role labels.
const fitY = (y) => 9 + ((y - 13) * 74) / 79

function TeamSlot({ slot, row, chem }) {
  const card = row.pick
  const { name: roleName, focus } = splitRole(row.role)
  return (
    <div
      className={`slot team-slot ${card ? `filled tier-${card.tier}` : 'empty'} ${row.owned ? 'is-owned' : 'is-needed'}`}
      style={{ left: `${slot.x}%`, top: `${fitY(slot.y)}%` }}
      title={`${slot.pos}: ${card ? card.name : row.pickName} · ${row.role}${row.owned ? ' · in your club' : ' · you need this player'}`}
    >
      {card ? (
        <>
          <span className="slot-rating">{card.rating}</span>
          <span className="slot-face"><Face card={card} /></span>
          <span className="slot-name">{card.name.length <= 12 ? card.name : card.name.split(' ').at(-1)}</span>
          <span className="chem-dots" aria-label={`${chem ?? 0} chemistry`}>
            {[0, 1, 2].map((i) => <i key={i} className={i < (chem ?? 0) ? 'on' : ''} />)}
          </span>
          {row.owned && <span className="owned-mark" aria-label="In your club">✓</span>}
        </>
      ) : (
        <span className="slot-plus">?</span>
      )}
      <span className="slot-pos">{slot.pos}</span>
      <span className={`slot-role focus-${focus.toLowerCase()}`}>{roleName}</span>
    </div>
  )
}

export default function TeamDetail({ teamId, allCards, ownedCards }) {
  const team = META_TEAMS.find((t) => t.id === teamId)
  const slots = useMemo(() => (team ? slotsOf(team.formation) : []), [team])
  const rows = useMemo(() => (team ? resolveTeam(team, allCards, ownedCards) : []), [team, allCards, ownedCards])
  const cards = rows.map((r) => r.pick)
  const chem = useMemo(() => chemistry(slots, cards), [slots, cards])
  const rating = teamRating(cards)
  const owned = rows.filter((r) => r.owned).length

  if (!team) {
    return (
      <p className="empty">
        This meta team doesn’t exist any more. <a href="#meta">Back to Meta</a>
      </p>
    )
  }

  const line = team.tactics.defensiveLine
  return (
    <div className="team-detail">
      <a className="back-link" href="#meta">← Meta teams</a>

      <header className="detail-head">
        <div>
          <h2>{team.name}</h2>
          <div className="tags">
            <span className="tag">{team.formation}</span>
            <span className="tag">Build-up: {team.tactics.buildUp}</span>
            <span className="tag">Defensive line {line}</span>
          </div>
        </div>
        <button type="button" className="primary" onClick={() => buildInSquadBuilder(team, rows)}>Build this team</button>
      </header>
      <p className="muted">{team.summary}</p>

      <div className="team-layout">
        <div className="pitch-wrap">
          <div className="squad-stats">
            <div><span className="label">Rating</span><strong>{rating}</strong></div>
            <div><span className="label">Chemistry</span><strong>{chem.total}<small>/33</small></strong></div>
            <div><span className="label">In your club</span><strong>{owned}<small>/11</small></strong></div>
            <div><span className="label">To get</span><strong>{11 - owned}</strong></div>
          </div>
          <div className="pitch team-pitch">
            <div className="pitch-lines" aria-hidden="true">
              <span className="halfway" />
              <span className="circle" />
              <span className="box top" />
              <span className="box bottom" />
            </div>
            <div className="line-marker" style={{ top: `${fitY(92 - line * 0.6)}%` }} aria-hidden="true">
              <span>Defensive line {line}</span>
            </div>
            {slots.map((slot, i) => <TeamSlot key={i} slot={slot} row={rows[i]} chem={chem.perSlot[i]} />)}
          </div>
          <div className="pitch-legend small muted">
            <span><i className="dot owned" /> In your club</span>
            <span><i className="dot needed" /> Meta pick you don’t own</span>
            <span><i className="dot focus-attack" /> Attack</span>
            <span><i className="dot focus-balanced" /> Balanced</span>
            <span><i className="dot focus-defend" /> Defend</span>
          </div>
        </div>

        <aside className="builder-side">
          <section className="side-panel">
            <h3>Tactics</h3>
            <div className="tactic">
              <span className="label">Build-up style</span>
              <strong>{team.tactics.buildUp}</strong>
              <p className="muted small">{BUILD_UP[team.tactics.buildUp] ?? ''}</p>
            </div>
            <div className="tactic">
              <span className="label">Defensive line</span>
              <strong>{line} · {lineLabel(line)}</strong>
              <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={line} aria-label="Defensive line height">
                <div style={{ width: `${line}%` }} />
              </div>
              <div className="meter-scale muted small"><span>Deep</span><span>High</span></div>
            </div>
            <p className="muted small">In game: Tactics → Custom, set the formation to {team.formation}, then set each player's role below.</p>
          </section>

          <section className="side-panel">
            <h3>Roles</h3>
            <ul className="role-list">
              {rows.map((r, i) => {
                const { name, focus } = splitRole(r.role)
                return (
                  <li key={i}>
                    <span className="slot-tag">{slots[i].pos}</span>
                    <span className="role-main">
                      <span>
                        {r.pick ? r.pick.name : r.pickName}
                        {r.owned ? <span className="owned-text"> ✓</span> : null}
                      </span>
                      <span className="muted small">
                        {r.players.filter((p) => p !== r.pickName).length ? `or ${r.players.filter((p) => p !== r.pickName).join(', ')}` : ' '}
                      </span>
                    </span>
                    <span className="role-tag">
                      <span>{name}</span>
                      {focus && <span className={`focus focus-${focus.toLowerCase()}`}>{focus}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <p className="muted small">
            Sources:{' '}
            {META_TEAMS_INFO.sources.map((s, i) => (
              <span key={s.url}>{i > 0 && ', '}<a href={s.url} target="_blank" rel="noreferrer">{s.name.split(':')[0]}</a></span>
            ))}
            . Base cards stand in for promo versions you don’t own.
          </p>
        </aside>
      </div>
    </div>
  )
}
