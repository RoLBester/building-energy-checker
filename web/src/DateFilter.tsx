import { useState } from 'react'
import type { DateRange } from './model'

interface Props {
  bounds: DateRange
  range: DateRange
  onChange: (range: DateRange) => void
}

export default function DateFilter({ bounds, range, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(range)
  function apply(next: DateRange) {
    onChange(next)
    setOpen(false)
    document.getElementById('date-filter-button')?.focus()
  }
  return <div className="range-control" onKeyDown={event => {
    if (event.key === 'Escape') {
      setOpen(false)
      document.getElementById('date-filter-button')?.focus()
    }
  }}>
    <button id="date-filter-button" type="button" className="secondary-button filter-toggle"
      aria-expanded={open} aria-controls="date-filter"
      onClick={() => { setDraft(range); setOpen(!open) }}>
      <span className="calendar-icon" aria-hidden="true" />Date range<span className="chevron" aria-hidden="true" />
    </button>
    {open && <form id="date-filter" className="date-filter" onSubmit={event => { event.preventDefault(); apply(draft) }}>
      <div className="dates">
        <label>From<input autoFocus type="date" required value={draft.start} min={bounds.start} max={bounds.end}
          onChange={e => setDraft({ ...draft, start: e.target.value })} /></label>
        <label>Through<input type="date" required value={draft.end} min={draft.start || bounds.start} max={bounds.end}
          onChange={e => setDraft({ ...draft, end: e.target.value })} /></label>
      </div>
      <div className="range-actions">
        <button className="text-button" type="button" onClick={() => apply(bounds)}>Full range</button>
        <button className="primary-button" type="submit">Apply range</button>
      </div>
    </form>}
  </div>
}
