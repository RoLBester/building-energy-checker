import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AnalysisSettings from './AnalysisSettings'
import DateFilter from './DateFilter'
import EnergyTerrain, { peakHour } from './EnergyTerrain'
import Icon from './Icon'
import { count, displayDate, displayRange } from './model'
import type { AnalysisRequest, DateRange, Day, Report, WorkerReply } from './model'

const demo: AnalysisRequest = { file: null, threshold: '500' }
const uciUrl = 'https://archive.ics.uci.edu/dataset/374/appliances+energy+prediction'
const noDays: Day[] = []
const sourceName = (file: File | null) => file?.name ?? 'UCI demo'

const Summary = memo(function Summary({ days, threshold }: { days: Day[]; threshold: string }) {
  const energy = days.reduce((sum, day) => sum + day.observedKwh, 0)
  const valid = days.reduce((sum, day) => sum + day.validReadings, 0)
  const high = days.reduce((sum, day) => sum + day.highReadings, 0)
  const kwh = days.length === 1 ? days[0].formattedKwh :
    energy.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  return <dl className="metrics" aria-label="Summary for selected dates">
    <div><dt>Observed energy</dt><dd className="metric-number">{kwh} <small>kWh</small></dd></div>
    <div><dt>Valid readings</dt><dd className="metric-number">{count(valid)}</dd></div>
    <div><dt>High readings <span>≥ {threshold} Wh</span></dt><dd className="metric-number">{count(high)}</dd></div>
  </dl>
})

function FileQuality({ report }: { report: Report }) {
  return <section className="quality" aria-labelledby="quality-title">
    <h3 id="quality-title">Whole-file coverage</h3>
    <dl>{[['Accepted', report.accepted], ['Rejected', report.rejected], ['Duplicates', report.duplicates]].map(([label, n]) =>
      <div key={label}><dt>{label}</dt><dd>{count(Number(n))}</dd></div>)}</dl>
  </section>
}

const DailyRegister = memo(function DailyRegister({ days, current, onInspect, report }: {
  days: Day[]; current?: string; onInspect: (day: Day) => void; report?: Report
}) {
  const ref = useRef<HTMLElement>(null)
  const [previewDate, setPreviewDate] = useState<string | null>(null)
  const preview = days.find(d => d.date === previewDate) ?? days.find(d => d.date === current)
  const peak = useMemo(() => days.reduce((max, d) =>
    Math.max(max, ...d.hours.map(bin => bin.wh)), 0) || 1, [days])
  useEffect(() => {
    const el = ref.current!
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('in-view'); observer.disconnect() }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const largest = days.reduce((max, day) => Math.max(max, day.observedKwh), 0) || 1
  return <section id="daily-results" className="register" ref={ref} aria-labelledby="register-title">
    <div className="register-inner">
      <div className="register-intro"><h2 id="register-title">Daily register</h2>
        <p>Observed energy by date. Partial days include only the readings collected.</p>
        {report && <FileQuality report={report} />}
        {preview && <figure className="register-trace" aria-label={`Hourly energy for ${displayDate(preview.date)}`}>
          <figcaption><span>Hourly Wh</span><time dateTime={preview.date}>{displayDate(preview.date)}</time></figcaption>
          <div className="trace-bins" aria-hidden="true">{preview.hours.map((bin, hour) =>
            <i key={hour} style={{ height: bin.readings ? `max(2px, ${bin.wh / peak * 100}%)` : '0%',
              transitionDelay: `${hour * 3}ms` }} />)}</div>
          <div className="trace-axis" aria-hidden="true"><span>00:00</span><span>12:00</span><span>23:00</span></div>
        </figure>}
      </div>
      <div className="register-data">
        <div className="register-subhead"><h3>Daily energy use</h3><span>{count(days.length)} observed {days.length === 1 ? 'day' : 'days'}</span></div>
        <div className="table-scroll">
          <table aria-label="Daily analysis results">
            <thead><tr><th scope="col">Date</th><th scope="col">Valid readings</th><th scope="col">Observed kWh</th><th scope="col">High readings</th></tr></thead>
            <tbody onPointerLeave={() => setPreviewDate(null)} onBlur={e => {
              if (!e.currentTarget.contains(e.relatedTarget)) setPreviewDate(null)
            }}>{days.map(day => <tr key={day.date} data-selected={day.date === current || undefined}
              onPointerEnter={e => { if (e.pointerType !== 'touch') setPreviewDate(day.date) }}
              onFocus={() => setPreviewDate(day.date)}>
              <th scope="row"><button type="button" aria-label={`Inspect ${displayDate(day.date)} in the hourly profile`}
                onClick={() => onInspect(day)}><time dateTime={day.date}>{displayDate(day.date)}</time></button></th>
              <td>{count(day.validReadings)}</td>
              <td className="energy-cell"><div className="energy-value"><span className="bar-track" aria-hidden="true">
                <i style={{ width: (day.observedKwh / largest * 100) + '%' }} /></span><span>{day.formattedKwh}</span></div></td>
              <td>{count(day.highReadings)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {report && !days.length && <p className="empty-state">No observations in this date range.</p>}
      </div>
    </div>
  </section>
})

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [threshold, setThreshold] = useState(demo.threshold)
  const [request, setRequest] = useState(demo)
  const [result, setResult] = useState<{ report: Report; applied: AnalysisRequest } | null>(null)
  const [range, setRange] = useState<DateRange | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(() => location.hash === '#analysis-settings')
  const [probe, setProbe] = useState<{ date: string; hour: number } | null>(null)
  const [atRegister, setAtRegister] = useState(false)
  const previousFile = useRef<File | null>(null)
  const firstLoad = useRef(true)
  const select = useCallback((date: string, hour: number) => setProbe({ date, hour }), [])
  const inspectDay = useCallback((day: Day) => {
    select(day.date, peakHour(day))
    document.querySelector<HTMLSelectElement>('.probe-date select')?.focus({ preventScroll: true })
    document.getElementById('overview')?.scrollIntoView()
  }, [select])

  useEffect(() => {
    const checkSection = () => setAtRegister((document.querySelector('#daily-results')?.getBoundingClientRect().top ?? Infinity) < innerHeight * .52)
    checkSection()
    window.addEventListener('scroll', checkSection, { passive: true })
    return () => window.removeEventListener('scroll', checkSection)
  }, [])

  useEffect(() => {
    let worker: Worker
    let jump = 0
    const failed = (message: string) => { setError(message); setBusy(false) }
    try {
      worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
        worker.terminate()
        if ('error' in data) { failed(data.error); return }
        const { report } = data
        if (report.error) {
          failed(report.error + (report.rejected ? ` Rejected rows: ${count(report.rejected)}.` : ''))
          return
        }
        if (request.file !== previousFile.current) { setRange(null); setProbe(null) }
        previousFile.current = request.file
        setResult({ report, applied: request })
        setBusy(false)
        if (request !== demo) setSettings(false)
        if (firstLoad.current && location.hash === '#daily-results') {
          jump = requestAnimationFrame(() => document.getElementById('daily-results')?.scrollIntoView({ behavior: 'instant' }))
        }
        firstLoad.current = false
      }
      worker.onerror = () => {
        worker.terminate()
        failed('Could not start the analysis engine. Run the analysis to retry.')
      }
      worker.postMessage(request)
    } catch {
      failed('Could not start local analysis in this browser. Try reloading the page.')
    }
    return () => { worker?.terminate(); cancelAnimationFrame(jump) }
  }, [request])

  const days = result?.report.days ?? noDays
  const bounds = days.length ? { start: days[0].date, end: days[days.length - 1].date } : null
  const selected = range ?? bounds
  const visible = useMemo(() => range ? days.filter(d => d.date >= range.start && d.date <= range.end) : days, [days, range])
  const chosen = visible.find(d => d.date === probe?.date)
  const day = chosen ?? visible.reduce<Day | undefined>((best, d) => !best || d.observedKwh > best.observedKwh ? d : best, undefined)
  const hour = chosen && probe ? probe.hour : day ? peakHour(day) : 0
  const pending = !!result && (file !== result.applied.file || threshold !== result.applied.threshold)
  const message = error + (error && result ? ` Showing the last result for ${sourceName(result.applied.file)} at ${result.applied.threshold} Wh.` : '')
  const openSettings = () => setSettings(true)

  return <>
    <a className="skip" href="#overview">Skip to energy overview</a>
    <aside className="rail" aria-label="Page navigation">
      <a className="rail-mark" href="#overview" aria-label="Building Energy Checker overview"><Icon name="mark" /></a>
      <nav aria-label="Page sections">
        <a href="#overview" aria-label="Energy overview" aria-current={!atRegister ? 'location' : undefined}><Icon name="readings" /><span>Overview</span></a>
        <a href="#daily-results" aria-label="Daily results" aria-current={atRegister ? 'location' : undefined}><Icon name="register" /><span>Register</span></a>
        <button type="button" aria-label="Analysis settings" onClick={openSettings}><Icon name="settings" /><span>Settings</span></button>
      </nav>
      <span className="rail-name">Building Energy Checker</span>
    </aside>
    <main>
      <section id="overview" className="survey" aria-labelledby="page-title">
        <div className="survey-inner">
          <div className="atlas">
            <div className="atlas-intro">
              <p className="wordmark"><Icon name="mark" />Building Energy Checker</p>
              <h1 id="page-title" aria-label="Energy atlas"><span>Energy</span> <em>atlas</em></h1>
              <p className="atlas-copy">Each ridge shows one day of appliance use. Select a point to see that hour’s readings.</p>
              <div className="source-caption"><span className="source-stroke" />{sourceName(result?.applied.file ?? null)}</div>
              <div className="atlas-dates">{selected ? displayRange(selected) : 'Loading readings…'}</div>
              <div className="hero-actions">
                {bounds && selected && <DateFilter key={bounds.start + bounds.end} bounds={bounds} range={selected} onChange={setRange} />}
                <button className="settings-toggle" type="button" aria-haspopup="dialog" onClick={openSettings}><Icon name="settings" />Analysis settings</button>
              </div>
            </div>
            {day ? <EnergyTerrain days={visible} day={day} hour={hour} onPick={select} /> :
              <div className="atlas-empty"><h2>Hourly load profile</h2><p>{busy ? 'Loading the energy profile…' : result ? 'No observations in this date range.' : 'Open analysis settings to run a file.'}</p></div>}
          </div>
          {message && !settings && <div className="error public-error" role="alert">{message} <button type="button" onClick={openSettings}>Open settings</button></div>}
          {result && <Summary days={visible} threshold={result.applied.threshold} />}
          <span className="sr-only" role="status">{busy ? 'Analyzing readings.' : error ? '' : pending ? 'Settings changed.' : 'Analysis complete.'}</span>
        </div>
      </section>
      <DailyRegister days={visible} current={day?.date} report={result?.report} onInspect={inspectDay} />
      <footer><strong>Building Energy Checker</strong><span>Demo readings by Luis M. Candanedo, UCI.</span>
        <a href={uciUrl}>Dataset</a><a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></footer>
    </main>
    <AnalysisSettings open={settings} onClose={() => setSettings(false)} file={file} threshold={threshold}
      busy={busy} error={message} pending={pending} onFile={f => { setFile(f); setError('') }}
      onThreshold={v => { setThreshold(v); setError('') }}
      onRun={() => { setError(''); setBusy(true); setRequest({ file, threshold }) }} />
  </>
}
