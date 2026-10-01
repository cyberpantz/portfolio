/**
 * "Let me speak to your manager." The fight runs on its own clock and
 * routes back to the script through onDone / onFled. Nothing here is copy.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Beat, BossStart } from '../../scripts/types';
import { Layer } from '../Layer';
import { sfx } from '../../sound/sfx';
import { fight, start, quarter } from './fight';
import { isPressKey } from './keys';
import { Xal } from './Xal';
import { Explosion } from './Explosion';
import pr from '../product.module.css';
import c from './boss.module.css';

type BossBeat = Extract<Beat, { t: 'boss' }>;
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

export function Boss({ beat, startPhase = 'entrance', onDone, onFled }: {
  beat: BossBeat;
  startPhase?: BossStart;
  onDone: () => void;
  onFled: () => void;
}) {
  const reducer = useMemo(() => fight(beat.levels), [beat.levels]);
  const [s, dispatch] = useReducer(reducer, undefined, () => start(now(), startPhase));
  const [closed, setClosed] = useState(false);
  const pressEl = useRef<HTMLButtonElement>(null);
  const loop = useRef<(() => void) | null>(null);
  // The key listener is bound once; it reads the phase through this, never through a stale `s`.
  const phase = useRef(s.phase);
  phase.current = s.phase;
  const level = beat.levels[s.level];

  useEffect(() => {
    if (closed) return;
    let raf = 0;
    const tick = () => { dispatch({ e: 'tick', t: now() }); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return dispatch({ e: 'flee', t: now() });
      if (!isPressKey(e, pressEl.current)) return;
      e.preventDefault();
      press(e.repeat);
    };
    window.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed]);

  useEffect(() => () => sfx().stopAll(), []);

  useEffect(() => {
    const a = sfx();
    if (s.phase === 'entrance') { a.play('klaxon'); a.play('descend', { at: 0.6 }); }
    if (s.phase === 'fighting') loop.current ??= a.play('boss-loop', { loop: true, gain: 0.5 });
    if (s.phase === 'burst') { loop.current?.(); loop.current = null; a.charge(null); a.play('explosion'); a.play('victory', { at: 0.7 }); }
    if (s.phase === 'respawn') a.play('respawn');
    if (s.phase === 'glitch') { loop.current = null; a.glitch(); }
    if (s.phase === 'failed') a.chime();
    if (s.phase === 'fled') { a.stopAll(); setClosed(true); onFled(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase]);

  useEffect(() => {
    if (s.phase === 'fighting') sfx().charge(s.size);
  }, [s.phase, s.size]);

  function press(repeat = false) {
    if (phase.current === 'entrance') return dispatch({ e: 'skip', t: now() });
    if (phase.current === 'fighting' && !repeat) sfx().press();
    dispatch({ e: 'press', t: now(), repeat });
  }

  if (closed) return <div className={pr.ack}>{beat.marker}</div>;

  const taunt = [...level.taunts].reverse().find((x) => s.size >= x.at)?.text;
  const said = s.idle ? beat.idle : taunt ?? level.greeting;

  return (
    <>
      <div className={pr.ack}>{beat.marker}</div>
      <Layer>
        <section className={c.arena} data-phase={s.phase} data-level={s.level}
          style={{ ['--shake' as string]: `${s.phase === 'fighting' ? s.size * 6 : 0}px` }}
          aria-label={level.name}>
          {s.phase === 'failed' ? (
            <div className={c.system} data-system role="alertdialog" aria-modal="true" aria-label={beat.failure.message}>
              <p>{beat.failure.message}</p>
              <button type="button" autoFocus onClick={() => { sfx().stopAll(); setClosed(true); onDone(); }}>
                {beat.failure.button}
              </button>
            </div>
          ) : (
            <>
              {(s.phase === 'entrance' || s.phase === 'respawn') && <p key={s.level} className={c.card}>{level.card}</p>}
              <div className={c.stage}>
                {s.phase !== 'burst' && <Xal size={s.size} level={s.level} />}
                {(s.phase === 'burst' || s.phase === 'glitch') && <Explosion freeze={s.phase === 'glitch'} />}
              </div>
              <header className={c.names}>
                <p className={c.name}>{level.name}</p>
                <p className={c.title}>{beat.title}</p>
                <p className={c.epithet}>{beat.epithet}</p>
              </header>
              {s.phase === 'burst' && <p className={c.victory}>{beat.victory}</p>}
              {s.phase === 'respawn' && <p className={c.toast}>{beat.respawn}</p>}
              {(s.phase === 'entrance' || s.phase === 'fighting') && <p className={c.says}>{said}</p>}
              <button ref={pressEl} type="button" className={c.press}
                disabled={s.phase !== 'fighting' && s.phase !== 'entrance'}
                onPointerDown={(e) => { e.preventDefault(); press(); }}>
                {beat.press}
              </button>
              <button type="button" className={c.leave} onClick={() => dispatch({ e: 'flee', t: now() })}>
                {beat.leave}
              </button>
              <p className={c.sr} aria-live="polite">{`${level.name} ${quarter(s.size)}%`}</p>
            </>
          )}
        </section>
      </Layer>
    </>
  );
}
