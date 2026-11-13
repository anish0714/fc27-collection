import { useMemo } from 'react'
import { META_TEAMS, META_TEAMS_INFO, resolveTeam } from '../lib/metaTeams.js'

const DRAFT_KEY = 'fc27-squad-draft'

// Puts a meta team on the Squad builder pitch and switches to that tab.
export function buildInSquadBuilder(team, rows) {
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

// A compact card: name, tactics and how much of it you own. Clicking it opens the team page,
// which has the players, roles and the pitch view.
function TeamCard({ team, allCards, ownedCards }) {
  const rows = useMemo(() => resolveTeam(team, allCards, ownedCards), [team, allCards, ownedCards])
  const ownedCount = rows.filter((r) => r.owned).length
  const href = `#team-${team.id}`
  const open = (e) => {
    if (e.target.closest('a, button')) return
    location.hash = `team-${team.id}`
  }

  return (
    <article className="team-card clickable" onClick={open}>
      <header>
        <div>
          <h3><a href={href}>{team.name}</a></h3>
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
      <footer>
        <span className="muted small">Players &amp; tactics →</span>
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
