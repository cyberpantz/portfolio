/**
 * The XAL-9000 fight as a pure reducer. Each press adds a fixed step; size
 * decays exponentially. With HEADROOM the equilibrium at the authored rate
 * sits above the burst point, so that rate bursts him in `seconds` and
 * anything under ~70% of it never does.
 */
import type { BossLevel, BossPhase, BossStart } from '../../scripts/types';

export const HEADROOM = 1.3;
export const ENTRANCE_MS = 4000;
export const BURST_MS = 2200;
export const RESPAWN_MS = 1800;
export const GLITCH_MS = 1400;
export const IDLE_MS = 10_000;

export type Fight = {
  phase: BossPhase;
  level: number;
  size: number;
  /** When the current phase began. */
  at: number;
  last: number;
  lastPress: number;
  idle: boolean;
};

export type FightEvent =
  | { e: 'press'; t: number; repeat?: boolean }
  | { e: 'tick'; t: number }
  | { e: 'skip'; t: number }
  | { e: 'flee'; t: number };

export function tuning(l: Pick<BossLevel, 'rate' | 'seconds'>) {
  const k = -Math.log(1 - 1 / HEADROOM) / l.seconds;
  return { k, step: (HEADROOM * k) / l.rate };
}

export function start(t: number, from: BossStart = 'entrance'): Fight {
  const base = { level: 0, size: 0, at: t, last: t, lastPress: t, idle: false };
  if (from === 'level2') return { ...base, phase: 'fighting', level: 1 };
  if (from === 'failed') return { ...base, phase: 'failed', level: 1 };
  return { ...base, phase: 'entrance' };
}

export const quarter = (size: number) => Math.floor(Math.min(size, 0.999) * 4) * 25;

const FLEEABLE: BossPhase[] = ['entrance', 'fighting', 'burst', 'respawn'];

export function fight(levels: BossLevel[]) {
  const tunes = levels.map(tuning);
  return (s: Fight, ev: FightEvent): Fight => {
    switch (ev.e) {
      case 'flee':
        return FLEEABLE.includes(s.phase) ? { ...s, phase: 'fled', at: ev.t } : s;
      case 'skip':
        return s.phase === 'entrance' ? { ...s, phase: 'fighting', at: ev.t, last: ev.t, lastPress: ev.t } : s;
      case 'press': {
        if (s.phase !== 'fighting' || ev.repeat) return s;
        const size = s.size + tunes[s.level].step;
        if (size < 1) return { ...s, size, lastPress: ev.t, idle: false };
        const last = s.level === levels.length - 1;
        return { ...s, size: 1, phase: last ? 'glitch' : 'burst', at: ev.t, lastPress: ev.t, idle: false };
      }
      case 'tick': {
        const since = ev.t - s.at;
        const n = { ...s, last: ev.t };
        switch (s.phase) {
          case 'entrance':
            return since >= ENTRANCE_MS ? { ...n, phase: 'fighting', at: ev.t, lastPress: ev.t } : n;
          case 'fighting': {
            if (ev.t - s.lastPress >= IDLE_MS) return { ...n, size: 0, idle: true };
            const dt = Math.max(0, ev.t - s.last) / 1000;
            return { ...n, size: s.size * Math.exp(-tunes[s.level].k * dt) };
          }
          case 'burst':
            return since >= BURST_MS ? { ...n, phase: 'respawn', level: s.level + 1, size: 0, at: ev.t } : n;
          case 'respawn':
            return since >= RESPAWN_MS ? { ...n, phase: 'fighting', at: ev.t, lastPress: ev.t } : n;
          case 'glitch':
            return since >= GLITCH_MS ? { ...n, phase: 'failed', at: ev.t } : n;
          default:
            return n;
        }
      }
    }
  };
}
