import { useEffect, useRef, useState } from 'react'
import DailyChart from './DailyChart'
import DateFilter from './DateFilter'
import Icon from './Icon'
import { count, displayDate, displayRange } from './model'
import type { AnalysisRequest, DateRange, Day, Report, WorkerReply } from './model'

const demo: AnalysisRequest = { file: null, threshold: '500' }
const uciUrl = 'https://archive.ics.uci.edu/dataset/374/appliances+energy+prediction'
const sourceName = (file: File | null) => file?.name ?? 'UCI demo'

function Summary({ days, threshold }: { days: Day[]; threshold: string }) {
  const energy = days.reduce((sum, day) => sum + day.observedKwh, 0)
  const valid = days.reduce((sum, day) => sum + day.validReadings, 0)
  const high = days.reduce((sum, day) => sum + day.highReadings, 0)
  const kwh = days.length === 1 ? days[0].formattedKwh :
    energy.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  return <section className="metrics" aria-label="Summary for selected dates">
    <div className="metric energy-metric">
      <h2><Icon name="energy" />Observed energy</h2>
      <div className="metric-number">{kwh} <small>kWh</small></div>
      <p>Across {count(days.length)} observed {days.length === 1 ? 'day' : 'days'}</p>
    </div>
    <div className="metric">
      <h2><Icon name="readings" />Valid readings</h2>
      <div className="metric-number">{count(valid)}</div>
      <p>Unique observations in range</p>
    </div>
    <div className="metric">
      <h2><Icon name="high" />High readings</h2>
      <div className="metric-number">{count(high)}</div>
      <p>At or above {threshold} Wh per reading</p>
    </div>
  </section>
}

function FileQuality({ report }: { report: Report }) {
  const total = report.accepted + report.rejected + report.duplicates
  const groups = [
    { label: 'Accepted', value: report.accepted, style: 'accepted' },
    { label: 'Rejected', value: report.rejected, style: 'rejected' },
    { label: 'Duplicates', value: report.duplicates, style: 'duplicates' },
  ]
  return <section className="panel quality" aria-labelledby="quality-title">
    <div className="section-heading"><h2 id="quality-title">File quality</h2><span className="file-total">{count(total)} rows</span></div>
    <p>Counts for the entire file.</p>
    <div className="quality-bar" aria-hidden="true">{groups.map(group =>
      <span key={group.style} className={group.style} style={{ width: `${100 * group.value / total}%` }} />)}</div>
    <dl>{groups.map(group => <div key={group.style}>
      <dt><i className={group.style} />{group.label}</dt><dd>{count(group.value)}</dd>
    </div>)}</dl>
  </section>
}

function ResultsTable({ days }: { days: Day[] }) {
  return <section id="daily-results" className="panel table-panel" aria-labelledby="results-title">
    <div className="section-heading"><h2 id="results-title">Daily results</h2><span className="file-total">{count(days.length)} {days.length === 1 ? 'day' : 'days'}</span></div>
    <p>Partial days include only the energy observed.</p>
    <div className="table-scroll">
      <table aria-label="Daily analysis results">
        <thead><tr><th scope="col">Date</th><th scope="col">Valid readings</th><th scope="col">Observed kWh</th><th scope="col">High readings</th></tr></thead>
        <tbody>{days.map(day => <tr key={day.date}>
          <th scope="row"><time dateTime={day.date}>{displayDate(day.date)}</time></th>
          <td>{count(day.validReadings)}</td><td>{day.formattedKwh}</td><td>{count(day.highReadings)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {!days.length && <p className="empty-state">No observations in this date range.</p>}
  </section>
}

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [threshold, setThreshold] = useState(demo.threshold)
  const [request, setRequest] = useState(demo)
  const [result, setResult] = useState<{ report: Report; applied: AnalysisRequest } | null>(null)
  const [range, setRange] = useState<DateRange | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const previousFile = useRef<File | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let worker: Worker
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
        if (request.file !== previousFile.current) setRange(null)
        previousFile.current = request.file
        setResult({ report, applied: request })
        setBusy(false)
      }
      worker.onerror = () => {
        worker.terminate()
        failed('Could not start the analysis engine. Run the analysis to retry.')
      }
      worker.postMessage(request)
    } catch {
      failed('Could not start local analysis in this browser. Try reloading the page.')
    }
    return () => worker?.terminate()
  }, [request])

  const days = result?.report.days ?? []
  const bounds = days.length ? { start: days[0].date, end: days[days.length - 1].date } : null
  const selected = range ?? bounds
  const visible = selected ? days.filter(day => day.date >= selected.start && day.date <= selected.end) : []
  const pending = result && (file !== result.applied.file || threshold !== result.applied.threshold)

  return <>
    <a className="skip" href="#overview">Skip to overview</a>
    <header className="topbar"><div className="shell nav-inner">
      <a className="brand" href="#overview"><img src={import.meta.env.BASE_URL + 'meter.svg'} width="32" height="32" alt="" />Building Energy Checker</a>
      <nav aria-label="Page sections"><a href="#analysis-settings"><span className="wide-label">Analysis </span>settings</a><a href="#daily-results">Daily results</a></nav>
    </div></header>
    <main className="shell" id="overview">
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-art" aria-hidden="true" />
        <div className="hero-copy">
          <div className="source-tag"><span aria-hidden="true" />{result ? sourceName(result.applied.file) : 'UCI demo'}</div>
          <h1 id="page-title">Energy overview</h1>
          <p>Compare daily appliance use and review high readings.</p>
          {selected && result && <div className="hero-meta">
            <span><Icon name="calendar" />{displayRange(selected)}</span>
            <span><Icon name="settings" />{result.applied.threshold} Wh threshold</span>
          </div>}
        </div>
      </section>
      {result && <Summary days={visible} threshold={result.applied.threshold} />}
      <div className="workspace">
        <div className="data-column">
          <section className="panel chart-panel" aria-labelledby="chart-title">
            <div className="section-heading">
              <div><h2 id="chart-title">Daily energy use</h2><p>Observed appliance energy per day</p></div>
              {bounds && selected && <DateFilter key={bounds.start + bounds.end} bounds={bounds} range={selected} onChange={setRange} />}
            </div>
            {result ? <DailyChart days={visible} /> : <p className="empty-state" role="status">{busy ? 'Loading the demo…' : 'Run an analysis to see daily energy use.'}</p>}
          </section>
          {result && <ResultsTable days={visible} />}
        </div>
        <aside className="controls-column" aria-label="Analysis and file quality">
          <section id="analysis-settings" className="panel settings" aria-labelledby="settings-title">
            <h2 id="settings-title"><Icon name="settings" />Analysis settings</h2>
            <form onSubmit={event => {
              event.preventDefault()
              setError('')
              setBusy(true)
              setRequest({ file, threshold })
            }}>
              <span className="field-label" id="source-label">Data source</span>
              <div className="source-field" role="group" aria-labelledby="source-label">
                <Icon name="file" /><span className="source-name">{sourceName(file)}</span>
                <label className="file-picker">Choose CSV<input ref={picker} type="file" accept=".csv,text/csv" aria-label="Choose CSV file"
                  onChange={e => { const next = e.target.files?.[0]; if (next) { setFile(next); setError('') } }} /></label>
              </div>
              {file && <button type="button" className="text-button use-demo" onClick={() => {
                setFile(null); setError(''); if (picker.current) picker.current.value = ''
              }}>Use demo data</button>}
              <label htmlFor="threshold">High-reading threshold</label>
              <div className="number-field"><input id="threshold" type="number" min="0" step="any" required
                aria-describedby="threshold-help" value={threshold} onChange={e => { setThreshold(e.target.value); setError('') }} />
                <span>Wh</span></div>
              <p id="threshold-help" className="field-help">Readings at or above this value are flagged for review.</p>
              <button type="submit" className="primary-button run-button" disabled={busy}><Icon name="play" />{busy ? 'Analyzing…' : 'Run analysis'}</button>
              <p className="privacy"><Icon name="lock" />CSV files stay on your device.</p>
              {error && <div className="error" role="alert">{error}{result && <span>Showing the last result for {sourceName(result.applied.file)} at {result.applied.threshold} Wh.</span>}</div>}
              <span className={pending && !error && !busy ? 'pending' : 'sr-only'} role="status">
                {busy ? 'Analyzing readings.' : error ? '' : pending ? 'Run analysis to apply your changes.' : 'Analysis complete.'}
              </span>
            </form>
          </section>
          {result && <FileQuality report={result.report} />}
        </aside>
      </div>
    </main>
    <footer className="shell"><span>Demo data from Luis M. Candanedo, UCI.</span>
      <a href={uciUrl}>Appliances Energy Prediction</a><a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></footer>
  </>
}
