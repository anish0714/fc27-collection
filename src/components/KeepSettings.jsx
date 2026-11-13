import { eaSquadList } from '../lib/keep.js'
import { pricesInfo } from '../lib/solver.js'

// Rules for which club players SBC plans must never use.
export default function KeepSettings({ keep, onChange }) {
  const set = (k, v) => onChange({ ...keep, [k]: v })
  const active = eaSquadList.find((s) => s.active)
  return (
    <div className="solver-settings">
      <span className="label">Never use</span>
      {eaSquadList.length > 0 && (
        <label>
          Players in
          <select id="keep-ea" value={keep.eaSquads} onChange={(e) => set('eaSquads', e.target.value)}>
            <option value="all">all my squads ({eaSquadList.length})</option>
            <option value="active">my active squad{active ? ` (${active.name})` : ''}</option>
            <option value="none">no squads</option>
          </select>
        </label>
      )}
      <label className="check">
        <input id="keep-saved" type="checkbox" checked={keep.savedSquads} onChange={(e) => set('savedSquads', e.target.checked)} />
        Saved squads
      </label>
      <label>
        Cards rated
        <input id="keep-rating" type="number" min="45" max="99" value={keep.rating} onChange={(e) => set('rating', e.target.value)} />+
      </label>
      <label>
        Promo cards rated
        <input id="keep-promo" type="number" min="45" max="99" value={keep.promoRating} onChange={(e) => set('promoRating', e.target.value)} />+
      </label>
      <span className="muted small">Meta list and Squad targets players are always kept. Prices: estimates from {pricesInfo.updatedAt}.</span>
    </div>
  )
}
