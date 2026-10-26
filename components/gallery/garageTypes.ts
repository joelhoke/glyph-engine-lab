/** Contract for the existing generated vehicle-playground runtime. */
export type VehicleLights = {
  beams: 'off' | 'low' | 'high'; signals: 'off' | 'left' | 'right' | 'hazards'
  fog: boolean; accent: boolean; tails: boolean; brakes: boolean; reverse: boolean
}
export type GarageState = { busy: boolean; hasLights: boolean; lightsOn: boolean; lamps?: VehicleLights; night?: boolean; orbit?: boolean; wire?: boolean; vehicles?: string[] }
export type Garage = {
  pickVehicle: (point: { x: number; y: number }) => string | null
  load: (id: string) => boolean
  toggleLights: (point?: { x: number; y: number }) => void
  setActive: (active: boolean, reduced: boolean) => void
  setNight: (night: boolean) => void
  setLights: (patch: Partial<VehicleLights>) => void
  setView: (view: string) => void
  setOrbit: (enabled: boolean) => void
  setWire: (enabled: boolean) => void
  dispose: () => void
}
