// Loading / saving data/my-collection.json.
// Dev server: GET/PUT /api/collection (see vite.config.js).
// Static build: localStorage, seeded from the collection file bundled at build time.
// data/my-collection.json is personal and git-ignored; without it (e.g. on GitHub Pages)
// the app starts from data/default-collection.json, which only holds the Meta cards list.
import defaultCollection from '../../data/default-collection.json'

const personal = Object.values(import.meta.glob('../../data/my-collection.json', { eager: true, import: 'default' }))[0]
const bundled = personal ?? defaultCollection

const API = 'api/collection'
const STORAGE_KEY = 'fc27-collection'

export const emptyCollection = () => ({ owned: [], customCards: [], packs: [], sbcs: [], targets: [], meta: [], squads: [] })

// Short unique id for SBCs, targets and meta entries.
export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

const arr = (v) => (Array.isArray(v) ? v : [])

// Accepts owned entries as { id, qty, addedAt } or plain numbers.
export function normalizeCollection(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const owned = []
  const seen = new Map()
  for (const entry of Array.isArray(data.owned) ? data.owned : []) {
    const e = typeof entry === 'object' && entry !== null ? entry : { id: entry }
    const id = Number(e.id)
    if (!Number.isFinite(id)) continue
    const qty = Math.max(1, Number(e.qty) || 1)
    if (seen.has(id)) {
      seen.get(id).qty += qty
      continue
    }
    const item = { ...e, id, qty, addedAt: e.addedAt ?? null }
    seen.set(id, item)
    owned.push(item)
  }
  return {
    ...data,
    owned,
    customCards: arr(data.customCards),
    packs: arr(data.packs),
    sbcs: arr(data.sbcs).map((s) => ({ ...s, requirements: arr(s.requirements) })),
    targets: arr(data.targets),
    meta: arr(data.meta),
    squads: arr(data.squads),
  }
}

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Returns { collection, mode: 'file' | 'local' }
export async function loadCollection() {
  try {
    const res = await fetch(API, { headers: { accept: 'application/json' } })
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      return { collection: normalizeCollection(await res.json()), mode: 'file' }
    }
  } catch {
    // no dev server: fall through to localStorage
  }
  return { collection: normalizeCollection(mergePublished(readLocal(), bundled)), mode: 'local' }
}

// On the static site, browser storage may hold an older copy. When a newer published
// collection ships, take its club cards and SBCs, and keep what this browser added itself.
function mergePublished(local, published) {
  if (!local) return published
  if (!published?.publishedAt || local.publishedAt === published.publishedAt) return local
  const byId = (list) => new Map((list ?? []).map((x) => [x.id, x]))
  const pubSbcs = byId(published.sbcs)
  const pubMeta = byId(published.meta)
  return {
    ...local,
    publishedAt: published.publishedAt,
    owned: published.owned ?? [],
    customCards: published.customCards ?? [],
    sbcs: [...(published.sbcs ?? []), ...(local.sbcs ?? []).filter((s) => !pubSbcs.has(s.id))],
    meta: [...(local.meta ?? []).filter((m) => !pubMeta.has(m.id)), ...(published.meta ?? []).map((m) => byId(local.meta).get(m.id) ?? m)],
  }
}

export async function saveCollection(collection, mode) {
  if (mode === 'file') {
    const res = await fetch(API, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(collection),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `HTTP ${res.status}`)
    }
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collection))
}
