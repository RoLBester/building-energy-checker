import { useEffect, useMemo, useRef } from 'react'
import { count, displayDate, wattHours, type Day } from './model'
import { mountTerrain } from './terrain'

export function peakHour(day: Day) {
  return day.hours.reduce((best, value, i, hours) =>
    value.readings && (!hours[best].readings || value.wh > hours[best].wh) ? i : best, 0)
}

interface Props {
  days: Day[]
  day: Day
  hour: number
  onPick: (date: string, hour: number) => void
}

export default function EnergyTerrain({ days, day, hour, onPick }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const painter = useRef<ReturnType<typeof mountTerrain>>(undefined)
  const index = days.indexOf(day)
  const start = Math.floor(index / 7) * 7
  const group = useMemo(() => days.slice(start, start + 7), [days, start])
  const localDay = index - start
  const current = useRef({ day: localDay, hour })
  useEffect(() => {
    current.current = { day: localDay, hour }
    painter.current?.select(current.current)
  }, [localDay, hour, group])
  useEffect(() => {
    painter.current = mountTerrain(canvas.current!, group, current.current,
      pick => onPick(group[pick.day].date, pick.hour))
    return () => { painter.current?.dispose(); painter.current = undefined }
  }, [group, onPick])

  const bin = day.hours[hour]
  const time = String(hour).padStart(2, '0') + ':00'
  const energy = bin.readings ? wattHours(bin.wh) + ' Wh' : 'Unobserved'
  const coverage = count(bin.readings) + (bin.readings === 1 ? ' valid reading' : ' valid readings')
  return <figure className="terrain" aria-labelledby="terrain-title">
    <figcaption className="terrain-heading">
      <h2 id="terrain-title">Hourly load profile</h2>
      <span>Wh by hour &amp; day</span>
    </figcaption>
    <canvas className="terrain-canvas" ref={canvas} role="img"
      aria-label={`Hourly appliance energy. ${displayDate(group[0].date)} through ${displayDate(group[group.length - 1].date)}. Select a day and hour below to inspect a measurement.`} />
    <div className="probe-console">
      <label className="probe-date">Inspect day
        <select value={day.date} aria-label="Inspect day" onChange={e => {
          const next = days.find(d => d.date === e.target.value)!
          onPick(next.date, peakHour(next))
        }}>{days.map(d => <option key={d.date} value={d.date}>{displayDate(d.date)}</option>)}</select>
      </label>
      <label className="hour-control"><span>Hour <output>{time}</output></span>
        <input aria-label="Inspect hour" aria-valuetext={`${time}, ${energy}, ${coverage}`} type="range" min="0" max="23" value={hour}
          style={{ backgroundSize: `${hour / 23 * 100}% 3px, 100% 3px` }}
          onChange={e => onPick(day.date, Number(e.target.value))} />
      </label>
      <div className="probe-reading" aria-live="off">
        <strong>{bin.readings ? <>{wattHours(bin.wh)} <small>Wh</small></> : 'Unobserved'}</strong>
        <span>{coverage}</span>
      </div>
    </div>
  </figure>
}
