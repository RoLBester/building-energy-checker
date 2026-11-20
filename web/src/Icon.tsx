const paths = {
  energy: 'M13 2 4 14h7l-1 8 10-13h-8z',
  readings: 'M3 12h4l3-8 4 16 3-8h4',
  high: 'M3 17h18M5 12l5-5 4 4 5-7m-5 0h5v5',
  file: 'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',
  settings: 'M3 7h7m4 0h7M3 17h11m4 0h3M10 4v6m6 4v6',
  lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3m-4 4v3',
  calendar: 'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
  play: 'm8 4 11 8-11 8z',
}

export default function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none"
    stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>
}
