export interface Day {
  date: string
  validReadings: number
  observedKwh: number
  formattedKwh: string
  highReadings: number
}

export interface Report {
  days: Day[]
  accepted: number
  rejected: number
  duplicates: number
  error: string
}

export interface AnalysisRequest {
  file: File | null
  threshold: string
}

export type WorkerReply = { report: Report } | { error: string }
export type DateRange = { start: string; end: string }

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
})

export function displayDate(date: string) {
  return dateFormat.format(new Date(date + 'T00:00:00Z'))
}

export function displayRange({ start, end }: DateRange) {
  return dateFormat.formatRange(new Date(start + 'T00:00:00Z'), new Date(end + 'T00:00:00Z'))
}

export const count = (value: number) => value.toLocaleString('en-GB')
