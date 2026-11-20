import { useState } from 'react'
import type { CSSProperties } from 'react'
import { count, displayDate, type Day } from './model'

function chartScale(max: number) {
  const ceiling = Math.max(max, 0.001)
  const target = ceiling / 5
  const power = 10 ** Math.floor(Math.log10(target))
  const step = ([1, 2, 2.5, 5, 10].find(n => n * power >= target) ?? 10) * power
  const intervals = Math.ceil(ceiling / step)
  return { top: intervals * step, ticks: Array.from({ length: intervals + 1 }, (_, i) => i * step) }
}

export default function DailyChart({ days }: { days: Day[] }) {
  const [selectedDate, setSelectedDate] = useState('')
  if (days.length === 0) return <p className="empty-state">No observations in this date range.</p>

  const peak = days.reduce((a, b) => a.observedKwh >= b.observedKwh ? a : b)
  const selected = days.find(day => day.date === selectedDate) ?? peak
  const { top, ticks } = chartScale(peak.observedKwh)
  const tickLabel = (n: number) => n >= 100000 ? n.toExponential(0) :
    n.toLocaleString('en-GB', { maximumSignificantDigits: 3 })

  return <figure className="chart" aria-label="Daily observed appliance energy in kilowatt-hours">
    <div className="axis-unit">kWh</div>
    <div className="plot-layout">
      <div className="y-axis" aria-hidden="true">
        {ticks.map((tick, i) => <span key={i} style={{ bottom: `${tick / top * 100}%` }}>{tickLabel(tick)}</span>)}
      </div>
      <div className="plot-scroll">
        <div className="plot-content" style={{ '--days': days.length } as CSSProperties}>
          <div className="plot">
            {ticks.map((tick, i) => <span aria-hidden="true" className="gridline" key={i}
              style={{ bottom: `${tick / top * 100}%` }} />)}
            {days.map(day => <button key={day.date} type="button" className="bar-target"
              aria-label={`${displayDate(day.date)}, ${day.formattedKwh} kWh`}
              aria-pressed={day === selected} onClick={() => setSelectedDate(day.date)}
              onFocus={() => setSelectedDate(day.date)}>
              <span className="bar" style={{ height: `${day.observedKwh / top * 100}%` }} />
            </button>)}
          </div>
          <div className="x-axis" aria-hidden="true">
            {days.map(day => {
              const [number, month] = displayDate(day.date).split(' ')
              return <span key={day.date}>{number}<small> {month}</small></span>
            })}
          </div>
        </div>
      </div>
    </div>
    <figcaption className="chart-detail">
      <span className="legend-dot" /><strong>{displayDate(selected.date)}</strong>
      <span>{selected.formattedKwh} kWh</span><span>{count(selected.validReadings)} valid readings</span>
      {selected === peak && <small>Peak day</small>}
    </figcaption>
  </figure>
}
