import { useEffect, useState } from 'react';

/**
 * Loads the track manifest.
 *
 * Fetched at runtime rather than imported, so adding a song is editing
 * public/audio/clickwheel/tracks.json — no rebuild, and the deck never
 * enters the JS bundle. The Quizzolator does the same thing with its
 * runtime quiz, so this matches how the rest of the site handles content
 * that is data rather than code.
 */

export type Track = {
  title: string;
  artist?: string;
  album?: string;
  src: string;
  /** Seconds. Optional — fills in from metadata if absent. */
  duration?: number;
};

export type TracksState = {
  tracks: Track[];
  /** True until the first fetch settles, either way. */
  loading: boolean;
  error: string | null;
};

const MANIFEST = '/audio/clickwheel/tracks.json';

function sane(t: unknown): t is Track {
  if (typeof t !== 'object' || t === null) return false;
  const r = t as Record<string, unknown>;
  return typeof r.title === 'string' && typeof r.src === 'string';
}

export function useTracks(url = MANIFEST): TracksState {
  const [state, setState] = useState<TracksState>({ tracks: [], loading: true, error: null });

  useEffect(() => {
    // A player that has navigated away should not commit a late response.
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(url, { signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: unknown = await res.json();
        const raw = (json as { tracks?: unknown }).tracks;
        /*
         * Filter rather than trust. This file is meant to be hand-edited,
         * so a missing comma or a typo'd key is the expected failure — and
         * one bad row should cost that row, not the whole library.
         */
        const tracks = Array.isArray(raw) ? raw.filter(sane) : [];
        setState({ tracks, loading: false, error: null });
      } catch (e) {
        if (ac.signal.aborted) return;
        setState({ tracks: [], loading: false, error: (e as Error).message });
      }
    })();
    return () => ac.abort();
  }, [url]);

  return state;
}

/** m:ss, or an em dash when the duration is not known yet. */
export function fmtTime(sec: number | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '—:—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
