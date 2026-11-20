declare module '*.mjs' {
  interface EnergyModule {
    analyze(csv: string, threshold: string): import('./model').Report
  }
  export default function createEnergy(options: {
    locateFile: (path: string) => string
  }): Promise<EnergyModule>
}
