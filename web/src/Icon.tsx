const paths = {
  mark: 'm2 16 5-11 5 11 4-8 6 12M2 20h9',
  readings: 'M2 14h4l3-9 4 14 3-9 2 4h4',
  register: 'M4 5h16M4 10h16M4 15h10M4 20h13',
  file: 'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',
  settings: 'M3 7h7m0-3v6m0-3h11M3 17h13m0-3v6m0-3h5',
  close: 'm5 5 14 14M19 5 5 19',
  lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3m-4 4v3',
  calendar: 'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
  play: 'm8 4 11 8-11 8z',
}
export default function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>
}
