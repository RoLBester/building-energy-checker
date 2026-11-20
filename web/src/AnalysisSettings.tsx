import { useEffect, useRef } from 'react'
import Icon from './Icon'

interface Props {
  open: boolean
  file: File | null
  threshold: string
  busy: boolean
  error: string
  pending: boolean
  onClose: () => void
  onFile: (value: File | null) => void
  onThreshold: (value: string) => void
  onRun: () => void
}

export default function AnalysisSettings(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const closing = useRef<Animation | null>(null)

  useEffect(() => {
    const el = dialog.current!
    if (props.open && !el.open) el.showModal()
    if (!props.open && el.open) el.close()
  }, [props.open])

  function dismiss() {
    const el = dialog.current!
    if (closing.current) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { props.onClose(); return }
    const animation = el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(105%)' }],
      { duration: 200, easing: 'cubic-bezier(.5,0,.8,.3)' })
    closing.current = animation
    animation.onfinish = () => { closing.current = null; props.onClose() }
  }

  return <dialog ref={dialog} className="settings-drawer" id="analysis-settings" aria-labelledby="settings-title"
    onCancel={e => { e.preventDefault(); dismiss() }} onClick={e => {
      if (e.target === e.currentTarget) {
        const box = e.currentTarget.getBoundingClientRect()
        if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dismiss()
      }
    }}>
    <div className="drawer-heading"><h2 id="settings-title">Analysis settings</h2>
      <button className="dismiss-button" type="button" aria-label="Close settings" onClick={dismiss}><Icon name="close" /></button></div>
    <form onSubmit={e => { e.preventDefault(); props.onRun() }}>
      <div className="setting-block"><span className="field-label">Source file</span>
        <div className="file-line"><Icon name="file" /><strong>{props.file?.name ?? 'UCI demo'}</strong></div>
        <label className="file-picker">Choose CSV<input ref={picker} type="file" accept=".csv,text/csv"
          aria-label="Choose CSV file" onChange={e => { if (e.target.files?.[0]) props.onFile(e.target.files[0]) }} /></label>
        {props.file && <button type="button" className="text-button use-demo" onClick={() => {
          props.onFile(null); if (picker.current) picker.current.value = ''
        }}>Use demo data</button>}
      </div>
      <div className="setting-block"><label className="field-label" htmlFor="threshold">High-reading threshold</label>
        <div className="threshold-field"><input id="threshold" type="number" min="0" step="any" required
          value={props.threshold} aria-describedby="threshold-help" onChange={e => props.onThreshold(e.target.value)} /><span>Wh</span></div>
        <p id="threshold-help">Individual readings at or above this value are flagged for review.</p>
      </div>
      <button type="submit" className="run-button" disabled={props.busy}><Icon name="play" />{props.busy ? 'Analyzing…' : 'Run analysis'}</button>
      <p className="privacy"><Icon name="lock" />CSV files stay on your device.</p>
      {props.error && <p className="error" role="alert">{props.error}</p>}
      {props.pending && !props.busy && !props.error && <p className="pending">Run analysis to apply your changes.</p>}
    </form>
  </dialog>
}
