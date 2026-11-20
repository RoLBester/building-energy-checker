import createEnergy from './generated/energy.mjs'
import wasmUrl from './generated/energy.wasm?url'
import type { AnalysisRequest, WorkerReply } from './model'

async function loadDemo() {
  const response = await fetch(import.meta.env.BASE_URL + 'uci-sample.csv')
  if (!response.ok) throw new Error('Could not load the demo CSV. Run the analysis to retry.')
  return response.text()
}

self.onmessage = async ({ data }: MessageEvent<AnalysisRequest>) => {
  let reply: WorkerReply
  try {
    const [engine, csv] = await Promise.all([
      createEnergy({ locateFile: () => wasmUrl }),
      data.file ? data.file.text() : loadDemo(),
    ])
    const report = engine.analyze(csv, data.threshold)
    reply = { report }
  } catch {
    const source = data.file ? 'the local CSV' : 'the demo CSV'
    reply = { error: `Could not load ${source} or the analysis engine. Run the analysis to retry.` }
  }
  self.postMessage(reply)
}
