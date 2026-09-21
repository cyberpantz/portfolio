import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from './useTracks';

/**
 * The audio engine: one <audio> element and the state around it.
 *
 * Deliberately an element rather than Web Audio. Playback here needs
 * streaming, seeking and buffered ranges, all of which <audio> does for
 * free and decodeAudioData does not — that path would have to fetch each
 * whole file before a note played, which for an 8-minute track is minutes
 * of nothing.
 */

export type AudioState = {
  index: number;
  playing: boolean;
  elapsed: number;
  duration: number;
  /** 0-1 of the file fetched, for the progress bar's buffered segment. */
  buffered: number;
  /** True between a load and the first frame that can play. */
  loading: boolean;
  error: string | null;
};

/**
 * Why a load failed, in words that fit a 176px screen.
 *
 * MediaError codes are the only honest source here — a failed <audio>
 * load does not report an HTTP status, so a 404 and a corrupt file both
 * arrive as the same `error` event and are told apart only by the code.
 * SRC_NOT_SUPPORTED is overwhelmingly the missing-file case in practice,
 * which is why it gets the friendlier wording.
 */
function reason(a: HTMLAudioElement): string {
  switch (a.error?.code) {
    case MediaError.MEDIA_ERR_ABORTED: return 'Load cancelled';
    case MediaError.MEDIA_ERR_NETWORK: return 'Network error';
    case MediaError.MEDIA_ERR_DECODE: return 'File is damaged';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: return 'Track unavailable';
    default: return 'Cannot play this track';
  }
}

export function useAudio(tracks: Track[]) {
  const el = useRef<HTMLAudioElement | null>(null);
  /*
   * "Play once this source is ready."
   *
   * Setting .src starts a load, and calling play() synchronously after it
   * races that load: Chrome aborts the play with "The play() request was
   * interrupted by a new load request" and Safari does much the same. The
   * track then sits there looking loaded and never starts.
   *
   * So intent is recorded here and acted on from the canplay handler,
   * which is the first moment playing is actually legal. The user gesture
   * still counts — autoplay policy tracks the gesture that led to the
   * load, not the exact call site.
   */
  const wantPlay = useRef(false);
  /*
   * Was this load automatic, or did someone ask for it?
   *
   * It decides what a failure DOES. Rolling off the end of a track into a
   * broken one should step over it — stopping the playlist dead on a file
   * the listener never chose is the ungraceful outcome. But when they
   * picked that track themselves, silently playing a different one is
   * worse than saying so: it looks like the wheel ignored them.
   */
  const auto = useRef(false);
  /*
   * Consecutive failures, so the skip above cannot become a loop. If every
   * file in the manifest is missing — a bad deploy, an offline visitor —
   * auto-advance would otherwise race the whole list forever. One full lap
   * and it stops and reports instead.
   */
  const fails = useRef(0);
  const [state, setState] = useState<AudioState>({
    index: 0, playing: false, elapsed: 0, duration: 0,
    buffered: 0, loading: false, error: null,
  });

  // Handlers below need the live track list without re-binding listeners.
  const list = useRef(tracks);
  list.current = tracks;

  useEffect(() => {
    const a = new Audio();
    a.preload = 'metadata';
    el.current = a;

    const patch = (p: Partial<AudioState>) => setState((s) => ({ ...s, ...p }));

    const onTime = () => {
      /*
       * buffered is a list of RANGES, not a single number: seeking leaves
       * gaps, so "how much is loaded" is the end of the range containing
       * the playhead, not simply buffered.end(0).
       */
      let buf = 0;
      const t = a.currentTime;
      for (let i = 0; i < a.buffered.length; i++) {
        if (a.buffered.start(i) <= t && t <= a.buffered.end(i)) {
          buf = a.buffered.end(i);
          break;
        }
      }
      patch({
        elapsed: t,
        duration: Number.isFinite(a.duration) ? a.duration : 0,
        buffered: a.duration > 0 ? buf / a.duration : 0,
      });
    };
    const onPlay = () => {
      fails.current = 0;   // something played; the run of failures is over
      patch({ playing: true, loading: false, error: null });
    };
    const onPause = () => patch({ playing: false });
    const onWaiting = () => patch({ loading: true });
    const onCanPlay = () => {
      patch({ loading: false, duration: Number.isFinite(a.duration) ? a.duration : 0 });
      if (wantPlay.current) {
        wantPlay.current = false;
        void a.play().catch((err: DOMException) => {
          // A real refusal, not the load race. Say so rather than hanging.
          patch({
            playing: false,
            error: err.name === 'NotAllowedError' ? 'Press play to start' : 'Cannot play this track',
          });
        });
      }
    };
    const onError = () => {
      const why = reason(a);
      fails.current++;
      const n = list.current.length;

      // Auto-advance walked into a bad file: step over it and keep going,
      // unless we have now tried everything.
      if (auto.current && n > 1 && fails.current < n) {
        setState((s) => {
          const next = (s.index + 1) % n;
          const t = list.current[next];
          if (t) { wantPlay.current = true; a.src = t.src; a.load(); }
          return { ...s, index: next, elapsed: 0, buffered: 0, duration: 0, error: null };
        });
        return;
      }

      // Either they chose this track, or the whole list is unreachable.
      wantPlay.current = false;
      auto.current = false;
      patch({
        error: fails.current >= n && n > 1 ? 'No tracks available' : why,
        playing: false,
        loading: false,
      });
    };
    const onEnded = () => {
      // Roll to the next track, wrapping at the end of the list.
      setState((s) => {
        const next = list.current.length ? (s.index + 1) % list.current.length : 0;
        const t = list.current[next];
        if (t) { auto.current = true; wantPlay.current = true; a.src = t.src; a.load(); }
        return { ...s, index: next, elapsed: 0, buffered: 0, error: null };
      });
    };

    a.addEventListener('timeupdate', onTime);
    a.addEventListener('progress', onTime);
    a.addEventListener('play', onPlay);
    a.addEventListener('playing', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('canplay', onCanPlay);
    a.addEventListener('loadedmetadata', onCanPlay);
    a.addEventListener('error', onError);
    a.addEventListener('ended', onEnded);

    return () => {
      a.pause();
      a.src = '';
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('progress', onTime);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('playing', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('canplay', onCanPlay);
      a.removeEventListener('loadedmetadata', onCanPlay);
      a.removeEventListener('error', onError);
      a.removeEventListener('ended', onEnded);
    };
  }, []);

  /** Load a track by index and start it once it is ready. */
  const playIndex = useCallback((i: number) => {
    const a = el.current;
    const t = list.current[i];
    if (!a || !t) return;
    auto.current = false;
    fails.current = 0;
    wantPlay.current = true;
    a.src = t.src;
    a.load();
    setState((s) => ({ ...s, index: i, elapsed: 0, buffered: 0, loading: true, error: null }));
  }, []);

  const toggle = useCallback(() => {
    const a = el.current;
    if (!a || !a.src || a.error) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  }, []);

  const step = useCallback((d: 1 | -1) => {
    setState((s) => {
      const n = list.current.length;
      if (!n) return s;
      const next = (s.index + d + n) % n;
      const a = el.current;
      const t = list.current[next];
      if (a && t) {
        auto.current = false;   // a deliberate skip; report a failure here
        fails.current = 0;
        wantPlay.current = true;
        a.src = t.src;
        a.load();
      }
      return { ...s, index: next, elapsed: 0, buffered: 0, error: null };
    });
  }, []);

  /** Seek by a fraction of the duration. */
  const seekBy = useCallback((frac: number) => {
    const a = el.current;
    if (!a || !Number.isFinite(a.duration) || a.duration <= 0) return;
    a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + frac * a.duration));
  }, []);

  return { state, playIndex, toggle, step, seekBy };
}
