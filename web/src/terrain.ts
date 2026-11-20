import { displayDate, wattHours, type Day } from './model'

type Point = { x: number; y: number }
export type Probe = { day: number; hour: number }
type Sample = Point & Probe

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n))
const eased = (n: number) => 1 - (1 - clamp(n)) ** 3
const clockHour = (n: number) => String(n).padStart(2, '0') + ':00'

/** A projected mesh of the observed clock-hour totals. Empty bins leave holes. */
export function mountTerrain(canvas: HTMLCanvasElement, days: Day[], initial: Probe,
  inspect: (sample: Probe) => void) {
  const ctx = canvas.getContext('2d')
  if (!ctx || !days.length) return
  const context = ctx
  const stage = canvas.closest<HTMLElement>('.survey')!
  const figure = canvas.closest('figure')!
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const fine = matchMedia('(any-pointer: fine)')
  const maximum = days.reduce((v, d) => Math.max(v, ...d.hours.map(h => h.wh)), 0) || 1
  const adjacent = days.map((d, i) => i > 0 &&
    Date.parse(d.date) - Date.parse(days[i - 1].date) === 86_400_000)
  const dateLabels = days.map(d => displayDate(d.date).replace(/ \d{4}$/, ''))
  let width = 0, height = 0, ratio = 1
  let frame = 0, timer = 0, visible = true, disposed = false
  let cursorX = 0, cursorY = 0, yaw = 0, pitch = 0
  let probe = initial
  let pointerOnPlot = false, sliceHour = initial.hour
  let reticle: Point | null = null
  let samples: Sample[] = []
  const started = performance.now()
  let last = started
  let changed = started

  function line(points: Point[], colour: string, weight = 1, close = false) {
    if (!points.length) return
    context.beginPath()
    context.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y)
    if (close) context.closePath()
    context.strokeStyle = colour
    context.lineWidth = weight
    context.stroke()
  }

  function face(points: Point[], colour: string | CanvasGradient) {
    context.beginPath()
    context.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y)
    context.closePath()
    context.fillStyle = colour
    context.fill()
  }

  function dot(point: Point, radius: number, colour: string | CanvasGradient) {
    context.beginPath()
    context.arc(point.x, point.y, radius, 0, Math.PI * 2)
    context.fillStyle = colour
    context.fill()
  }

  // The hour runs along x, dates recede into the scene, and Wh determines height.
  function project(hour: number, depth: number, energy: number): Point {
    const t = hour / 23
    const narrow = width < 500
    const left = narrow ? 12 : 20
    const axisWidth = width - left - (narrow ? 42 : 65)
    return {
      x: left + axisWidth * (.75 * t + .22 * depth + .014
        + yaw * (.034 * (depth - .45) + .045 * energy)),
      y: height * (.85 - .095 * t - .29 * depth - .435 * energy
        + pitch * (.035 * (depth - .5) - .019 * energy) + yaw * .045 * (t - .5)),
    }
  }

  const depthOf = (day: number) => days.length === 1 ? .43 : 1 - day / (days.length - 1)

  function drawFloor() {
    const plate = [project(-.6, -.05, 0), project(23.6, -.05, 0),
      project(23.6, 1.05, 0), project(-.6, 1.05, 0)]
    const wash = context.createLinearGradient(0, height * .5, 0, height)
    wash.addColorStop(0, 'rgba(61,113,107,.05)')
    wash.addColorStop(1, 'rgba(47,104,93,.26)')
    face(plate, wash)
    line(plate, 'rgba(154,191,173,.33)', 1, true)
    for (let hour = 0; hour < 24; hour++) {
      line([project(hour, -.04, 0), project(hour, 1.04, 0)],
        hour % 6 === 0 ? '#415c5a' : '#263e40', .7)
    }
    for (let i = 0; i <= 12; i++) {
      line([project(-.5, i / 12, 0), project(23.5, i / 12, 0)], '#2b4545', .7)
    }
    const back = project(0, 1.02, 0)
    line([back, project(0, 1.02, 1.04)], 'rgba(137,180,171,.40)', .8)
    for (let i = 0; i <= 4; i++) {
      const p = project(0, 1.02, i / 4)
      line([{ x: p.x - 4, y: p.y }, p], '#6a8984')
    }
    context.font = '11px "IBM Plex Mono", monospace'
    context.fillStyle = '#a1b7ad'
    context.textAlign = 'left'
    const top = project(0, 1.02, 1.04)
    context.fillText(maximum.toLocaleString('en-GB', { maximumSignificantDigits: 4 }) + ' Wh', top.x + 6, top.y + 2)
  }

  // The pale section follows one clock hour through all the observed dates.
  function drawSection(layers: Point[][], hour: number) {
    const h = Math.floor(hour), end = Math.ceil(hour), f = hour - h
    let previous: Point | undefined
    days.forEach((day, i) => {
      if (!day.hours[h].readings || !day.hours[end].readings) { previous = undefined; return }
      const a = layers[i][h], b = layers[i][end]
      const point = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
      if (previous && adjacent[i]) {
        face([previous, point, project(hour, depthOf(i), 0), project(hour, depthOf(i - 1), 0)],
          'rgba(168,239,211,.13)')
        line([previous, point], '#a7d9c7', 1.15)
      }
      dot(point, 1.7, '#cce8d8')
      previous = point
    })
  }

  function drawLabel(point: Point, label: string) {
    context.font = '11px "IBM Plex Mono", monospace'
    context.textAlign = 'left'
    const w = Math.min(width - 12, context.measureText(label).width + 16)
    const x = clamp(point.x + 12, 5, width - w - 5)
    const y = clamp(point.y - 34, 3, height - 25)
    context.fillStyle = '#122b2d'
    context.fillRect(x, y, w, 23)
    context.fillStyle = '#ffb682'
    context.fillRect(x, y, 2, 23)
    context.fillStyle = '#f7eee0'
    context.fillText(label, x + 8, y + 15.5, w - 12)
  }

  function draw(now: number) {
    frame = 0
    if (!width || !height || disposed || !visible || document.hidden) return
    const still = reduced.matches
    const dt = Math.min(64, now - last)
    last = now
    const follow = still ? 1 : 1 - Math.exp(-dt / 115)
    yaw += ((still ? 0 : cursorX) - yaw) * follow
    pitch += ((still ? 0 : cursorY) - pitch) * follow
    sliceHour += (probe.hour - sliceHour) * follow
    if (Math.abs(probe.hour - sliceHour) < .002) sliceHour = probe.hour
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.lineJoin = 'round'
    context.lineCap = 'round'
    drawFloor()
    samples = []
    const elapsed = now - started
    const layers = days.map((day, i) => day.hours.map((bin, hour) => {
      const amount = still ? 1 : eased((elapsed - i * 48 - hour * 5) / 760)
      const p = project(hour, depthOf(i), bin.wh / maximum * amount)
      if (bin.readings) samples.push({ ...p, day: i, hour })
      return p
    }))

    // Interleave faces and ridge lines from back to front. The data lines sit
    // on the mesh; the finer lines between dates are visual guides.
    days.forEach((day, i) => {
      const points = layers[i]
      const depth = depthOf(i)
      const active = i === probe.day
      for (let h = 0; h < 23; h++) {
        if (!day.hours[h].readings || !day.hours[h + 1].readings) continue
        const a = points[h], b = points[h + 1]
        const previous = days[i - 1]
        if (adjacent[i] && previous.hours[h].readings && previous.hours[h + 1].readings) {
          const c = layers[i - 1][h + 1], d = layers[i - 1][h]
          const lum = Math.round(15 + 21 * day.hours[h].wh / maximum + 5 * depth)
          face([d, c, b, a], 'hsl(172 28% ' + lum + '%)')
          for (let lane = 1; lane <= 3; lane++) {
            const f = lane / 4
            line([{ x: d.x + (a.x - d.x) * f, y: d.y + (a.y - d.y) * f },
              { x: c.x + (b.x - c.x) * f, y: c.y + (b.y - c.y) * f }], 'rgba(145,203,175,.42)', .7)
          }
          line([d, a], 'rgba(151,211,184,.68)', .75)
          line([c, b], 'rgba(151,211,184,.48)', .7)
        }
        // A transparent vertical section makes the nearest open edge legible.
        if (!adjacent[i + 1] || !days[i + 1].hours[h].readings || !days[i + 1].hours[h + 1].readings) {
          const baseA = project(h, depth, 0), baseB = project(h + 1, depth, 0)
          face([a, b, baseB, baseA], 'rgba(39,92,79,.47)')
          line([a, baseA], 'rgba(128,193,158,.48)', .7)
          line([b, baseB], 'rgba(128,193,158,.48)', .7)
        }
        line([a, b], active ? '#ffbb81' : '#a0d9b6', active ? 2 : 1.2)
      }
      day.hours.forEach((bin, h) => {
        if (bin.readings && (active || (!day.hours[h - 1]?.readings && !day.hours[h + 1]?.readings))) {
          dot(points[h], active ? 1.7 : 1.3, active ? '#ffd2a2' : '#b7e3ce')
        }
      })
      // Keep a day label clear of the mesh, along the right edge of the floor.
      if (width >= 440 || i === 0 || i === days.length - 1 || active) {
        const p = project(23.6, depth, 0)
        context.textAlign = 'left'
        context.fillStyle = active ? '#ffc697' : '#91aaa4'
        context.fillText(day.date.slice(8) + '/' + day.date.slice(5, 7), p.x + 4, p.y + 4)
      }
    })
    context.fillStyle = '#afc1b9'
    context.textAlign = 'center'
    for (const h of [0, 6, 12, 18, 23]) {
      const p = project(h, -.07, 0)
      context.fillText(clockHour(h), p.x + (h === 0 ? 5 : 0), p.y + 17)
    }

    const bin = days[probe.day]?.hours[probe.hour]
    if (bin) {
      const inspecting = pointerOnPlot || figure.contains(document.activeElement)
      if (inspecting) drawSection(layers, sliceHour)
      const goal = layers[probe.day][probe.hour]
      if (!reticle || still) reticle = { ...goal }
      reticle.x += (goal.x - reticle.x) * follow
      reticle.y += (goal.y - reticle.y) * follow
      const foot = project(probe.hour, depthOf(probe.day), 0)
      context.setLineDash([2, 4])
      line([foot, reticle], '#f9c899', 1)
      context.setLineDash([])
      // Re-trace the selected day's measurements above any intervening faces.
      const row = days[probe.day].hours
      for (let h = 0; h < 23; h++) {
        if (row[h].readings && row[h + 1].readings) {
          line([layers[probe.day][h], layers[probe.day][h + 1]], 'rgba(255,174,114,.82)', 1.6)
        }
      }
      const pulse = still ? 0 : clamp(1 - (now - changed) / 540)
      const glow = context.createRadialGradient(reticle.x, reticle.y, 0, reticle.x, reticle.y, 22 + 10 * pulse)
      glow.addColorStop(0, 'rgba(255,174,100,.52)')
      glow.addColorStop(1, 'rgba(255,163,89,0)')
      dot(reticle, 22 + 10 * pulse, glow)
      context.beginPath()
      context.arc(reticle.x, reticle.y, 7 + 7 * pulse, 0, Math.PI * 2)
      context.strokeStyle = '#ffba7c'
      context.stroke()
      dot(reticle, 3, bin.readings ? '#fff2d4' : '#192b2b')
      if (inspecting) {
        const value = bin.readings ? wattHours(bin.wh) + ' Wh' : 'Unobserved'
        drawLabel(reticle, dateLabels[probe.day] + '  ' + clockHour(probe.hour) + '  ' + value)
      }
    }

    // A brief, travelling glint identifies the live inspection line. Sleep
    // between passes and stop the frame loop entirely when the plot is hidden.
    const phase = (elapsed % 4700) / 1250
    if (!still && phase < 1 && elapsed > 1000) {
      const t = phase * 23, h = Math.floor(t), f = t - h
      const row = days[probe.day]
      if (row.hours[h]?.readings && row.hours[h + 1]?.readings) {
        const a = layers[probe.day][h], b = layers[probe.day][h + 1]
        dot({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, 2.2, '#ffedcc')
      }
    }
    const settling = Math.abs(yaw - cursorX) + Math.abs(pitch - cursorY) > .002
    if (!still && (elapsed < 1300 || settling || now - changed < 750 || phase < 1)) {
      frame = requestAnimationFrame(draw)
    } else if (!still) {
      timer = window.setTimeout(wake, 4700 - (elapsed % 4700) + 1)
    }
  }

  function wake() {
    clearTimeout(timer)
    if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(draw)
  }
  function select(next: Probe) {
    if (next.day === probe.day && next.hour === probe.hour) return
    probe = next
    changed = performance.now()
    wake()
  }
  function pick(e: PointerEvent) {
    if (!pointerOnPlot) { pointerOnPlot = true; wake() }
    const box = canvas.getBoundingClientRect()
    const x = e.clientX - box.left, y = e.clientY - box.top
    let closest: Sample | undefined, distance = Infinity
    for (const p of samples) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2
      if (d < distance) { closest = p; distance = d }
    }
    if (closest && distance < 54 ** 2 && (closest.day !== probe.day || closest.hour !== probe.hour)) {
      const next = { day: closest.day, hour: closest.hour }
      select(next)
      inspect(next)
    }
  }
  function move(e: PointerEvent) {
    if (e.pointerType === 'touch') return
    if (fine.matches && !reduced.matches) {
      const rect = stage.getBoundingClientRect()
      const nx = clamp((e.clientX - rect.left) / rect.width), ny = clamp((e.clientY - rect.top) / rect.height)
      cursorX = nx * 2 - 1
      cursorY = ny * 2 - 1
      stage.style.setProperty('--light-x', (nx * 100).toFixed(2) + '%')
      stage.style.setProperty('--light-y', (ny * 100).toFixed(2) + '%')
      wake()
    }
    if (e.target === canvas) pick(e)
    else if (pointerOnPlot) { pointerOnPlot = false; wake() }
  }
  function reset() {
    cursorX = 0; cursorY = 0; pointerOnPlot = false
    stage.style.removeProperty('--light-x')
    stage.style.removeProperty('--light-y')
    wake()
  }
  function resize() {
    const box = canvas.getBoundingClientRect()
    width = box.width; height = box.height
    ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    reticle = null
    wake()
  }
  function visibility() {
    cancelAnimationFrame(frame); frame = 0; clearTimeout(timer)
    if (visible && !document.hidden) wake()
  }
  const size = new ResizeObserver(resize)
  size.observe(canvas)
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visibility() })
  observer.observe(canvas)
  stage.addEventListener('pointermove', move, { passive: true })
  stage.addEventListener('pointerleave', reset)
  canvas.addEventListener('pointerdown', pick)
  figure.addEventListener('focusin', wake)
  figure.addEventListener('focusout', wake)
  reduced.addEventListener('change', reset)
  document.addEventListener('visibilitychange', visibility)
  document.fonts.ready.then(() => { if (!disposed) wake() })
  return { select, dispose() {
    disposed = true
    size.disconnect(); observer.disconnect(); clearTimeout(timer); cancelAnimationFrame(frame)
    stage.removeEventListener('pointermove', move)
    stage.removeEventListener('pointerleave', reset)
    canvas.removeEventListener('pointerdown', pick)
    figure.removeEventListener('focusin', wake)
    figure.removeEventListener('focusout', wake)
    reduced.removeEventListener('change', reset)
    document.removeEventListener('visibilitychange', visibility)
  } }
}
