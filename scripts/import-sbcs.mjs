// Merges an SBC export from the FC 27 Web App into data/my-collection.json.
//
//   node scripts/import-sbcs.mjs [data/sbc-export.json]
//
// Each SBC set becomes one entry in `sbcs` (id "ea-<setId>", tagged fromWebApp),
// with one checklist line per challenge. Running it again refreshes those entries
// but keeps the cost and notes you typed, and a "skipped" status you set.
// SBCs you added by hand are left alone.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const exportFile = resolve(root, process.argv[2] ?? 'data/sbc-export.json')
const collectionFile = resolve(root, 'data/my-collection.json')

const { sets, exportedAt } = JSON.parse(readFileSync(exportFile, 'utf8'))
const collection = JSON.parse(readFileSync(collectionFile, 'utf8'))
const previous = new Map((collection.sbcs ?? []).filter((s) => s.fromWebApp).map((s) => [s.id, s]))
const manual = (collection.sbcs ?? []).filter((s) => !s.fromWebApp)

// EA gives permanent SBCs an end time years away; treat anything over a year out as "never expires".
const NO_EXPIRY = (Date.parse(exportedAt) || Date.now()) / 1000 + 365 * 24 * 3600
function expiryDate(end) {
  if (!end || end > NO_EXPIRY) return ''
  const d = new Date(end * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Drops placeholder awards like "1 coins" or "80 --- Unlock".
const cleanAwards = (awards) => awards.filter((a) => !/^1 coins$/.test(a) && !a.includes('---'))

function requirementLine(ch) {
  const parts = [...ch.r]
  if (ch.sc) parts.push(`submit ${ch.sc.toLocaleString('en-US')} score`)
  let line = ch.n ? `${ch.n} · ${parts.join(', ')}` : parts.join(', ')
  const reward = cleanAwards(ch.aw)
  if (reward.length) line += ` → ${reward.join(', ')}`
  return line
}

const imported = sets.map((s) => {
  const id = `ea-${s.id}`
  const prev = previous.get(id)
  const repeatable = s.repeat !== 'NON_REPEATABLE'
  const completed = !repeatable && s.total > 0 && s.done >= s.total
  const started = s.ch.some((c) => c.st === 'IN_PROGRESS' || c.st === 'COMPLETED')
  const single = s.ch.length === 1 && s.ch[0].n === s.name
  const requirements = s.ch.map((c) => ({
    text: single ? requirementLine({ ...c, n: '' }) : requirementLine(c),
    done: c.st === 'COMPLETED',
  }))
  const notes = [s.desc.trim(), repeatable && s.times ? `Done ${s.times}× so far.` : ''].filter(Boolean).join(' ')
  return {
    id,
    fromWebApp: true,
    name: s.name,
    category: s.cat,
    reward: cleanAwards(s.awards).join(', '),
    expires: expiryDate(s.end),
    cost: prev?.cost ?? 0,
    repeatable,
    status: prev?.status === 'skipped' ? 'skipped' : completed ? 'done' : started ? 'doing' : 'todo',
    requirements,
    notes: prev?.notes && prev.notes !== prev.importedNotes ? prev.notes : notes,
    importedNotes: notes,
    addedAt: prev?.addedAt ?? exportedAt ?? new Date().toISOString(),
  }
})

writeFileSync(collectionFile, JSON.stringify({ ...collection, sbcs: [...manual, ...imported] }, null, 2) + '\n')
const open = imported.filter((s) => s.status !== 'done').length
console.log(`Imported ${imported.length} SBCs from the Web App (${open} open), kept ${manual.length} added by hand.`)
