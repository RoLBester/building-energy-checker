import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import createEnergy from '../web/src/generated/energy.mjs'

const wasmBinary = await readFile(new URL('../web/src/generated/energy.wasm', import.meta.url))
const engine = await createEnergy({ wasmBinary })

test('only accepted readings contribute to the 24 hourly totals', async () => {
  const csv = await readFile(new URL('./fixtures/small.csv', import.meta.url), 'utf8')
  const { days } = engine.analyze(csv, '500')
  for (const day of days) {
    assert.equal(day.hours.length, 24)
    assert.equal(day.hours.reduce((n, hour) => n + hour.readings, 0), day.validReadings)
    assert.equal(day.hours.reduce((wh, hour) => wh + hour.wh, 0) / 1000, day.observedKwh)
  }
  assert.deepEqual(days[0].hours[17], { wh: 610, readings: 2 })
  assert.deepEqual(days[1].hours[17], { wh: 80, readings: 1 })
})

test('measured zero and missing hours remain distinct across midnight', () => {
  const csv = ['date,Appliances', '2016-01-11 23:59:59,2.5', '2016-01-12 00:00:00,0'].join('\n')
  const { days } = engine.analyze(csv, '500')
  assert.deepEqual(days[0].hours[23], { wh: 2.5, readings: 1 })
  assert.deepEqual(days[1].hours[0], { wh: 0, readings: 1 })
  assert.deepEqual(days[1].hours[1], { wh: 0, readings: 0 })
})
