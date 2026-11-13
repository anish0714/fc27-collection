import { useMemo, useState } from 'react'
import { META_TEAMS, META_TEAMS_INFO, resolveTeam } from '../lib/metaTeams.js'

const DRAFT_KEY = 'fc27-squad-draft'

// Puts a meta team on the Squad builder pitch and switches to that tab.
function buildInSquadBuilder(team, rows) {
  const draft = {
    formation: team.formation,
    ids: rows.map((r) => (r.pick ? r.pick.id : null)),
    name: team.name,
    roles: rows.map((r) => r.role),
    teamId: team.id,
  }
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // storage blocked: the builder opens empty
  }
  location.hash = 'squad'
}

function TeamCard({ team, allCards, ownedCards }) {
  const [open, setOpen] = useState(false)
  const rows = useMemo(() => resolveTeam(team, allCards, ownedCards), [team, allCards, ownedCards])
  const ownedCount = rows.filter((r) => r.owned).length
  const shown = open ? rows : rows.slice(5) // midfield + attack first, defence on demand

  return (
    <article className="team-card">
      <header>
        <div>
          <h3>{team.name}</h3>
          <div className="tags">
            <span className="tag">{team.formation}</span>
            <span className="tag">Build-up: {team.tactics.buildUp}</span>
            <span className="tag">Def. line {team.tactics.defensiveLine}</span>
          </div>
        </div>
        <div className="team-owned">
          <strong>{ownedCount}</strong>
          <small>/11 in your club</small>
        </div>
      </header>
      <p className="muted small">{team.summary}</p>
      <ul className="team-rows">
        {shown.map((r, i) => (
          <li key={i} className={r.owned ? 'owned' : ''}>
            <span className="slot-tag">{r.pos}</span>
            <span className="team-player">
              <span>
                {r.pick ? r.pick.name : r.pickName}
                {r.pick?.custom && <span className="muted small"> · {r.pick.version}</span>}
              </span>
              <span className="muted small">{r.role}{r.players.length > 1 ? ` · or ${r.players.filter((p) => p !== r.pickName).join(', ')}` : ''}</span>
            </span>
            {r.pick && <span className={`rating-badge tier-${r.pick.tier}`}>{r.pick.rating}</span>}
            <span className={`team-status ${r.owned ? 'yes' : 'no'}`}>{r.owned ? '✓ Owned' : 'Need'}</span>
          </li>
        ))}
      </ul>
      <footer>
        <button type="button" className="link" onClick={() => setOpen((v) => !v)}>{open ? 'Hide defence' : 'Show all 11'}</button>
        <button type="button" className="primary" onClick={() => buildInSquadBuilder(team, rows)}>Build this team</button>
      </footer>
    </article>
  )
}

export default function MetaTeams({ allCards, ownedCards }) {
  return (
    <section className="meta-teams">
      <div className="meta-teams-head">
        <h2>Meta teams</h2>
        <p className="muted small">
          Formations, tactics and roles from{' '}
          {META_TEAMS_INFO.sources.map((s, i) => (
            <span key={s.url}>{i > 0 && ' and '}<a href={s.url} target="_blank" rel="noreferrer">{s.name.split(':')[0]}</a></span>
          ))}
          , updated {META_TEAMS_INFO.updatedAt}. Your own cards are used where you have them; base cards stand in for promo versions you don't own.
        </p>
      </div>
      <div className="team-grid">
        {META_TEAMS.map((t) => <TeamCard key={t.id} team={t} allCards={allCards} ownedCards={ownedCards} />)}
      </div>
    </section>
  )
}
