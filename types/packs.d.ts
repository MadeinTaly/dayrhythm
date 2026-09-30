import type { Config } from './index.js';

/** A pack is a plain, JSON-serialisable partial config plus metadata. */
export interface Pack extends Config {
  id: string;
  title: string;
  description: string;
}
export type PackId =
  | 'light-scenes' | 'aquarium-reef' | 'screen-filter' | 'thermostat' | 'irrigation' | 'blinds' | 'pool-pump' | 'ev-charging'
  | 'grow-light' | 'office-hours' | 'water-heater' | 'ventilation' | 'pet-feeder' | 'presence-simulation' | 'garden-lighting' | 'sleep-wake';

export const packs: Record<PackId, Pack>;
declare const pack: Pack;
export default pack;
