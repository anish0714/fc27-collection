import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Meta from './components/Meta.jsx'
import MetaTeams from './components/MetaTeams.jsx'
import TeamDetail from './components/TeamDetail.jsx'
import Packs from './components/Packs.jsx'
import PlayerCard from './components/PlayerCard.jsx'
import Sbcs from './components/Sbcs.jsx'
import SquadBuilder from './components/SquadBuilder.jsx'
import Targets from './components/Targets.jsx'
import { POSITION_GROUPS, TIERS, foldText, toCustomCard } from './lib/cards.js'
import { emptyCollection, loadCollection, newId, normalizeCollection, saveCollection } from './lib/collection.js'
import { playerKey } from './lib/squad.js'
import { makeKeeper, readKeep, saveKeep } from './lib/keep.js'
import SbcDetail from './components/SbcDetail.jsx'

const PAGE = 120
const DEFAULT_FILTERS = { q: '', own: 'all', tier: 'all', pos: 'all', league: 'all', gender: 'all', sort: 'rating' }
const SAVE_TARGET = { file: 'data/my-collection.json', local: 'this browser (localStorage)' }

const searchText = (c) => foldText([c.name, c.firstName, c.lastName, c.club, c.nation, c.league, c.position, ...(c.altPositions ?? []), c.version].join(' '))

function formatDate(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { dateStyle: 'medium' })
}

async function loadCards() {
  const res = await fetch(`${import.meta.env.BASE_URL}cards.json`)
  // Vite's dev server answers missing files with index.html, so check the type too.
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
  const data = await res.json()
  for (const c of data.cards) c._q = searchText(c)
  return data
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  )
}

const TABS = ['cards', 'squad', 'sbcs', 'targets', 'meta', 'packs']
const tabFromHash = () => {
  const h = location.hash.slice(1)
  if (h.startsWith('sbc-')) return 'sbcs'
  if (h.startsWith('team-')) return 'meta'
  return TABS.includes(h) ? h : null
}
const detailFromHash = () => (location.hash.startsWith('#sbc-') ? decodeURIComponent(location.hash.slice(5)) : null)
const teamFromHash = () => (location.hash.startsWith('#team-') ? decodeURIComponent(location.hash.slice(6)) : null)

export default function App() {
  const [cardsData, setCardsData] = useState(undefined) // undefined = loading, null = missing
  const [cardsError, setCardsError] = useState(null)
  const [collection, setCollection] = useState(emptyCollection)
  const [mode, setMode] = useState(null)
  const [saveStatus, setSaveStatus] = useState({ state: 'idle' })
  const [tab, setTabState] = useState(() => tabFromHash() ?? 'cards')
  const [detailId, setDetailId] = useState(() => detailFromHash())
  const [teamId, setTeamId] = useState(() => teamFromHash())
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [limit, setLimit] = useState(PAGE)
  const [editMode, setEditMode] = useState(false)
  const collectionRef = useRef(collection)
  const saveChain = useRef(Promise.resolve())
  const importInput = useRef(null)

  // #sbc-<id> opens an SBC's page, #team-<id> a meta team's page; #<tab> opens a tab. Back / forward work.
  useEffect(() => {
    const onHash = () => {
      setDetailId(detailFromHash())
      setTeamId(teamFromHash())
      const t = tabFromHash()
      if (t) setTabState(t)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const setTab = useCallback((t) => {
    if (location.hash !== `#${t}`) location.hash = t
    setTabState(t)
    setDetailId(null)
    setTeamId(null)
  }, [])

  useEffect(() => {
    loadCards().then(setCardsData).catch((err) => {
      setCardsError(err.message)
      setCardsData(null)
    })
    loadCollection().then(({ collection, mode }) => {
      collectionRef.current = collection
      setCollection(collection)
      setMode(mode)
    })
  }, [])

  const commit = useCallback(
    (next) => {
      collectionRef.current = next
      setCollection(next)
      setSaveStatus({ state: 'saving' })
      // Serialise saves so a slow PUT can't overwrite a newer one.
      saveChain.current = saveChain.current
        .then(() => saveCollection(next, mode))
        .then(
          () => collectionRef.current === next && setSaveStatus({ state: 'saved' }),
          (err) => setSaveStatus({ state: 'error', message: err.message }),
        )
    },
    [mode],
  )

  const toggleOwned = useCallback(
    (id) => {
      const current = collectionRef.current
      const has = current.owned.some((o) => o.id === id)
      const owned = has
        ? current.owned.filter((o) => o.id !== id)
        : [...current.owned, { id, qty: 1, addedAt: new Date().toISOString() }]
      commit({ ...current, owned })
    },
    [commit],
  )

  // Replaces one list (sbcs, targets, meta) in the collection and saves it.
  const setList = useCallback((key, list) => commit({ ...collectionRef.current, [key]: list }), [commit])

  const addMetaToTargets = useCallback(
    (m) => {
      const current = collectionRef.current
      const target = {
        id: newId(),
        name: m.name,
        version: m.version ?? '',
        rating: m.rating ?? null,
        position: m.position ?? '',
        price: Number(m.price) || 0,
        priority: m.tier === 'S' ? 'high' : 'med',
        replaces: '',
        why: m.notes ?? '',
        status: 'want',
        addedAt: new Date().toISOString(),
      }
      commit({ ...current, targets: [target, ...current.targets] })
    },
    [commit],
  )

  const baseCards = useMemo(() => cardsData?.cards ?? [], [cardsData])
  const customCards = useMemo(
    () => collection.customCards.map((c) => {
      const card = toCustomCard(c)
      card._q = searchText(card)
      return card
    }),
    [collection.customCards],
  )
  const allCards = useMemo(() => [...customCards, ...baseCards], [customCards, baseCards])
  const qtyById = useMemo(() => new Map(collection.owned.map((o) => [o.id, o.qty])), [collection.owned])
  const qtyOf = useCallback((card) => (card.custom ? 1 : qtyById.get(card.id) ?? 0), [qtyById])

  const lookup = useMemo(() => new Map(allCards.map((c) => [String(c.id), c])), [allCards])

  // Every card in the club (base cards you own + special cards), for the squad builder.
  const ownedCards = useMemo(() => allCards.filter((c) => qtyOf(c) > 0), [allCards, qtyOf])
  const ownedKeys = useMemo(() => new Set(ownedCards.map(playerKey)), [ownedCards])
  // Which club players SBC plans must never use (your squads + good cards).
  const [keep, setKeepState] = useState(readKeep)
  const setKeep = useCallback((k) => {
    setKeepState(k)
    saveKeep(k)
  }, [])
  const isKept = useMemo(
    () => makeKeeper({ settings: keep, savedSquads: collection.squads, lookup, meta: collection.meta, targets: collection.targets }),
    [keep, collection.squads, lookup, collection.meta, collection.targets],
  )

  // Folded names of every player in the club, for "In club" hints on targets and meta cards.
  const ownedNames = useMemo(() => {
    const names = new Set()
    const add = (c) => {
      if (!c) return
      names.add(foldText(c.name))
      if (c.firstName || c.lastName) names.add(foldText(`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()))
    }
    for (const o of collection.owned) add(lookup.get(String(o.id)))
    for (const c of customCards) add(c)
    return names
  }, [collection.owned, customCards, lookup])

  const leagues = useMemo(() => {
    const counts = new Map()
    for (const c of allCards) if (c.league) counts.set(c.league, (counts.get(c.league) ?? 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [allCards])

  const progress = useMemo(() => {
    const tiers = { gold: [0, 0], silver: [0, 0], bronze: [0, 0] }
    let owned = 0
    for (const c of baseCards) {
      tiers[c.tier][1]++
      if (qtyById.has(c.id)) {
        tiers[c.tier][0]++
        owned++
      }
    }
    return { owned, total: baseCards.length, tiers, special: customCards.length }
  }, [baseCards, customCards, qtyById])

  const deferredQ = useDeferredValue(filters.q)
  const filtered = useMemo(() => {
    const q = foldText(deferredQ).trim()
    const terms = q ? q.split(/\s+/) : []
    const group = filters.pos === 'all' ? null : POSITION_GROUPS[filters.pos]
    const list = allCards.filter((c) => {
      const owned = qtyOf(c) > 0
      if (filters.own === 'owned' && !owned) return false
      if (filters.own === 'missing' && owned) return false
      if (filters.tier !== 'all' && c.tier !== filters.tier) return false
      if (group && !group.includes(c.position)) return false
      if (filters.league !== 'all' && c.league !== filters.league) return false
      if (filters.gender !== 'all' && c.gender !== filters.gender) return false
      return terms.every((t) => c._q.includes(t))
    })
    const byRating = (a, b) => b.rating - a.rating || a.name.localeCompare(b.name)
    const sorters = {
      rating: byRating,
      owned: (a, b) => (qtyOf(b) > 0) - (qtyOf(a) > 0) || byRating(a, b),
      name: (a, b) => a.name.localeCompare(b.name) || b.rating - a.rating,
    }
    return list.sort(sorters[filters.sort])
  }, [allCards, deferredQ, filters, qtyOf])

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setLimit(PAGE)
  }

  function exportCollection() {
    const blob = new Blob([JSON.stringify(collectionRef.current, null, 2) + '\n'], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: 'my-collection.json' })
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importCollection(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const next = normalizeCollection(JSON.parse(await file.text()))
      const msg = `Replace your collection with ${file.name}? (${next.owned.length} owned, ${next.customCards.length} special, ${next.packs.length} packs, ${next.sbcs.length} SBCs, ${next.targets.length} targets, ${next.meta.length} meta cards)`
      if (window.confirm(msg)) commit(next)
    } catch (err) {
      window.alert(`Couldn't import ${file.name}: ${err.message}`)
    }
  }

  const pct = progress.total ? (progress.owned / progress.total) * 100 : 0
  const shown = filtered.slice(0, limit)

  return (
    <div className="app">
      <header className="site-header">
        <div>
          <h1>FC 27 Collection</h1>
          <p className="meta">
            {cardsData
              ? `${cardsData.count.toLocaleString()} cards · data fetched ${formatDate(cardsData.fetchedAt)}`
              : cardsData === undefined
                ? 'Loading cards…'
                : 'No card data'}
          </p>
        </div>
        <div className="io-buttons">
          <button type="button" onClick={exportCollection}>Export</button>
          <button type="button" disabled={!mode} onClick={() => importInput.current?.click()}>Import</button>
          <input ref={importInput} type="file" accept="application/json,.json" hidden onChange={importCollection} />
        </div>
      </header>

      <section className="progress-panel" aria-label="Collection progress">
        <div className="progress-head">
          <span>
            <strong>{progress.owned.toLocaleString()}</strong> / {progress.total.toLocaleString()} base cards
          </span>
          <span className="pct">{pct.toFixed(pct > 0 && pct < 1 ? 2 : 1)}%</span>
        </div>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="chips">
          {Object.entries(progress.tiers).map(([tier, [have, total]]) => (
            <span key={tier} className={`chip tier-${tier}`}>
              {tier} {have.toLocaleString()}/{total.toLocaleString()}
            </span>
          ))}
          <span className="chip tier-special">special {progress.special}</span>
        </div>
      </section>

      {cardsData === null && (
        <div className="notice" role="alert">
          <strong>No card data found.</strong> Run <code>npm run fetch-cards</code> to download every FC 27 card into{' '}
          <code>public/cards.json</code>, then reload.
          {cardsError && <div className="notice-detail">({cardsError})</div>}
        </div>
      )}

      <nav className="tabs" role="tablist">
        {[
          ['cards', 'Cards', null],
          ['squad', 'Squad builder', null],
          ['sbcs', 'SBCs', collection.sbcs.filter((s) => s.status !== 'done' && s.status !== 'skipped').length],
          ['targets', 'Squad targets', collection.targets.filter((t) => t.status !== 'got').length],
          ['meta', 'Meta', collection.meta.length],
          ['packs', 'Packs opened', collection.packs.length],
        ].map(([id, label, count]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label} {count != null && <span className="count">{count}</span>}
          </button>
        ))}
      </nav>

      {tab !== 'cards' && tab !== 'packs' && saveStatus.state === 'error' && (
        <p className="save-status error" role="alert">Save failed: {saveStatus.message}</p>
      )}

      {teamId ? (
        <main>
          <TeamDetail teamId={teamId} allCards={allCards} ownedCards={ownedCards} />
        </main>
      ) : detailId ? (
        <main>
          {collection.sbcs.find((s) => s.id === detailId) ? (
            <SbcDetail
              sbc={collection.sbcs.find((s) => s.id === detailId)}
              clubCards={ownedCards}
              isKept={isKept}
              keep={keep}
              onKeepChange={setKeep}
              onUpdate={(patch) => setList('sbcs', collectionRef.current.sbcs.map((s) => (s.id === detailId ? { ...s, ...patch } : s)))}
            />
          ) : (
            <p className="empty">{mode ? <>This SBC isn’t in your list any more. <a href="#sbcs">Back to SBCs</a></> : 'Loading…'}</p>
          )}
        </main>
      ) : tab === 'squad' ? (
        <main>
          <SquadBuilder
            allCards={allCards}
            ownedCards={ownedCards}
            ownedKeys={ownedKeys}
            lookup={lookup}
            sbcs={collection.sbcs}
            squads={collection.squads}
            onSquadsChange={(l) => setList('squads', l)}
          />
        </main>
      ) : tab === 'sbcs' ? (
        <main><Sbcs sbcs={collection.sbcs} onChange={(l) => setList('sbcs', l)} clubCards={ownedCards} isKept={isKept} keep={keep} onKeepChange={setKeep} /></main>
      ) : tab === 'targets' ? (
        <main><Targets targets={collection.targets} ownedNames={ownedNames} onChange={(l) => setList('targets', l)} /></main>
      ) : tab === 'meta' ? (
        <main className="meta-main">
          <MetaTeams allCards={allCards} ownedCards={ownedCards} />
          <h2 className="section-title">Meta cards</h2>
          <Meta meta={collection.meta} targets={collection.targets} ownedNames={ownedNames} onChange={(l) => setList('meta', l)} onTarget={addMetaToTargets} />
        </main>
      ) : tab === 'cards' ? (
        <main>
          <div className="filters">
            <input
              className="search"
              type="search"
              placeholder="Search name, club, nation, league, position…"
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
              aria-label="Search cards"
            />
            <Segmented
              label="Ownership"
              value={filters.own}
              onChange={(v) => setFilter('own', v)}
              options={[['all', 'All'], ['owned', 'Owned'], ['missing', 'Missing']]}
            />
            <select value={filters.tier} onChange={(e) => setFilter('tier', e.target.value)} aria-label="Tier">
              <option value="all">All tiers</option>
              {TIERS.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
            <select value={filters.pos} onChange={(e) => setFilter('pos', e.target.value)} aria-label="Position group">
              <option value="all">All positions</option>
              {Object.keys(POSITION_GROUPS).map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={filters.league} onChange={(e) => setFilter('league', e.target.value)} aria-label="League">
              <option value="all">All leagues</option>
              {leagues.map(([name, n]) => <option key={name} value={name}>{name} ({n})</option>)}
            </select>
            <select value={filters.gender} onChange={(e) => setFilter('gender', e.target.value)} aria-label="Men or women">
              <option value="all">Men &amp; women</option>
              <option value="M">Men</option>
              <option value="W">Women</option>
            </select>
            <select value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="Sort">
              <option value="rating">Sort: rating</option>
              <option value="owned">Sort: owned first</option>
              <option value="name">Sort: name</option>
            </select>
          </div>

          <div className="edit-row">
            <label className="edit-toggle">
              <input type="checkbox" disabled={!mode} checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
              Tap cards to mark owned
            </label>
            <span className={`save-status ${saveStatus.state}`} aria-live="polite">
              {saveStatus.state === 'saving' && 'Saving…'}
              {saveStatus.state === 'saved' && `Saved to ${SAVE_TARGET[mode]}`}
              {saveStatus.state === 'error' && `Save failed: ${saveStatus.message}`}
              {saveStatus.state === 'idle' && mode && `Saving to ${SAVE_TARGET[mode]}`}
            </span>
            <span className="result-count">{filtered.length.toLocaleString()} cards</span>
          </div>

          {shown.length ? (
            <div className="grid">
              {shown.map((card) => (
                <PlayerCard key={card.id} card={card} qty={qtyOf(card)} editMode={editMode} onToggle={toggleOwned} />
              ))}
            </div>
          ) : (
            cardsData !== undefined && <p className="empty">No cards match these filters.</p>
          )}

          {filtered.length > limit && (
            <button type="button" className="show-more" onClick={() => setLimit((n) => n + PAGE)}>
              Show more ({(filtered.length - limit).toLocaleString()} left)
            </button>
          )}
        </main>
      ) : (
        <main>
          <Packs packs={collection.packs} lookup={lookup} />
        </main>
      )}

      <footer className="site-footer">
        Unofficial fan project, not affiliated with EA. Player data and images © EA SPORTS. The ratings database only
        includes base cards; add promos (TOTW, Icons, Heroes, evolutions) as <code>customCards</code>.
      </footer>
    </div>
  )
}
