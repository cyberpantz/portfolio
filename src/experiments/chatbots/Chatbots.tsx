import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Line, NodeId, ScenarioId } from './scripts/types';
import { SCENARIOS, SCENARIO_LIST } from './scripts';
import { useDirector } from './director/useDirector';
import { OutcomeBadge } from './components/OutcomeBadge';
import { BeatView } from './components/BeatView';
import { Composer, type ComposerHandle } from './components/Composer';
import { Rig, type Mode } from './apparatus/Rig';
import { Tray } from './apparatus/Tray';
import a from './apparatus/apparatus.module.css';
import s from './components/product.module.css';
import './skins/skins.css';

/**
 * Chatbots — the island root.
 *
 * `skin` and `scenario` are separate on purpose: a skin is visual tokens,
 * a scenario is script plus voice plus options. Keeping them orthogonal
 * lets the conversation re-skin IN PLACE, mid-sentence, without
 * resetting — a better demonstration than three separate demos, because
 * the copy holds still while everything around it moves.
 */


export type ChatbotsProps = {
  skin?: ScenarioId;
  mode?: Mode;
  startAt?: NodeId;
  /** false renders the device alone — a clean screenshot with no furniture. */
  apparatus?: boolean;
};

/*
 * The default is whichever scenario leads the tabs, not a name typed
 * here. Hard-coding 'care' meant reordering the list landed the visitor
 * on the second tab with the first one sitting unselected beside it,
 * which looks like a bug rather than a choice — and it was one more
 * hand-copied duplicate of a value that lives in SCENARIO_LIST.
 */
const FIRST = SCENARIO_LIST[0].id;

export default function Chatbots({
  skin: initialSkin = FIRST,
  mode: initialMode = 'play',
  startAt,
  apparatus = true,
}: ChatbotsProps) {
  /*
   * The picker chooses a SCENARIO now, and the skin follows it.
   *
   * They remain separate props — any script still renders under any
   * token block, which is what makes them orthogonal — but the control
   * offers the pairing, because a menu that recolours a conversation
   * without changing it is a control that lies about its own scope.
   */
  const [skin, setSkin] = useState<ScenarioId>(initialSkin);
  const scenario = SCENARIOS[skin] ?? SCENARIOS.care;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [entry, setEntry] = useState<NodeId | undefined>(startAt);
  const [hasStash, setHasStash] = useState(false);

  const d = useDirector({ scenario, startAt: entry, watch: mode === 'watch' });
  const composer = useRef<ComposerHandle>(null);
  const log = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [unread, setUnread] = useState(0);

  const locked = d.phase === 'locked';
  const constrained = d.phase === 'waiting' && !!d.node.constrained;

  /* ---- scroll: follow only when already at the bottom -------------
   *
   * Not a nicety. The 9-second think and the meat-thermometer line both
   * fail outright if the view yanks itself downward mid-sentence.
   */
  const onScroll = useCallback(() => {
    const el = log.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    atBottom.current = near;
    if (near) setUnread(0);
  }, []);

  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      setUnread((n) => n + 1);
    }
  }, [d.turns.length]);

  const jumpDown = () => {
    const el = log.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    atBottom.current = true;
    setUnread(0);
  };

  /* ---- the state browser -------------------------------------------
   *
   * Index mode inspects a node rather than jumping the conversation to
   * it. Clicking "Thinking" used to deep-link the director there and
   * play forward from it, which answered a question nobody asked: the
   * point of a state index is to see ONE state, on its own, with
   * whatever came before it left out.
   *
   * It is also non-destructive. The director is never touched, so
   * browsing the parts and then closing the panel returns the visitor to
   * the conversation they were having, mid-sentence, intact.
   */
  const [inspect, setInspect] = useState<NodeId | null>(null);
  useEffect(() => {
    if (mode !== 'index') setInspect(null);
  }, [mode]);
  const inspected = inspect ? (scenario.nodes[inspect] ?? null) : null;

  const fill = (line: Line) => composer.current?.fill(line.text);

  const device = (
    <div className={`${s.device} sb-skin sb-morph`} data-skin={skin}>
      {/* The badge reports on a conversation. There isn't one in here. */}
      {!inspected && <OutcomeBadge scenario={scenario} strip={d.strip} />}

      {/*
       * role="log" + polite: new assistant messages announce, and nothing
       * else does. Focus never moves on an assistant turn — moving focus
       * into arriving content steals the caret mid-sentence, which is the
       * classic chat-a11y failure. Safety is the one exception and moves
       * focus itself.
       */}
      <div
        ref={log}
        className={s.log}
        onScroll={onScroll}
        role={inspected ? 'group' : 'log'}
        aria-live={inspected ? 'off' : 'polite'}
        aria-relevant="additions"
        aria-busy={!inspected && d.phase === 'playing'}
        aria-label={inspected ? 'One state, on its own' : 'Conversation'}
      >
        {/*
         * One state, out of context.
         *
         * Its controls stay live and re-aim at the browser: a chip moves
         * you to the state it points at, which keeps every button
         * honest — an inert chip in a piece whose whole argument is that
         * affordances must not lie would be the worst possible place to
         * put one.
         *
         * `grouped` is recomputed here rather than read off a turn,
         * because grouping is a property of two adjacent lines, and
         * there are no turns in this mode.
         */}
        {inspected
          ? inspected.say.map((beat, i) => (
              <div key={`${inspected.id}-${i}`} className={s.turn}>
                <BeatView
                  beat={beat}
                  grouped={beat.t === 'say' && inspected.say[i - 1]?.t === 'say'}
                  h={{
                    choose: (c) => setInspect(c.go),
                    pick: (_label, to) => to && setInspect(to),
                    go: (id) => setInspect(id),
                  }}
                />
              </div>
            ))
          : d.turns.map((t, i) =>
          t.who === 'user' ? (
            <div key={t.id} className={s.turn} style={{ alignItems: 'flex-end' }}>
              <div className={s.me} data-bubble>
                {t.text}
              </div>
            </div>
          ) : (
            <div key={t.id} className={s.turn}>
              {/*
                * The answer to a beat is the user turn that follows it.
                *
                * Nothing needs to be recorded for this: the transcript
                * already holds it, because choosing a chip emits its
                * label as your own message. Reading it back from the
                * next turn keeps the controls stateless and means the
                * settled look survives a re-render for free.
                */}
              <BeatView
                beat={t.beat}
                grouped={t.grouped}
                h={{
                  choose: d.choose,
                  pick: (label, to) => d.pick(label, to),
                  time: d.pickTime,
                  picked: d.picked ?? undefined,
                  go: d.go,
                  pulse: d.nudge === 'hint',
                  chosen:
                    d.turns[i + 1]?.who === 'user'
                      ? (d.turns[i + 1] as { text: string }).text
                      : undefined,
                }}
              />
            </div>
          )
        )}

        {/*
         * The 25s idle offer used to live here — "Want me to just show
         * you?" with a chip that switched to Watch mode. Removed.
         *
         * Two things wrong with it. It duplicated a control that already
         * exists in the apparatus, six inches below, permanently
         * visible; and it was the PRODUCT offering to play itself, which
         * is the product stepping outside its own fiction. A care
         * navigator does not know it is a demo. The rig does, which is
         * why the rig is where that button belongs.
         *
         * The 12s chip pulse survives. A hint that the controls are
         * waiting is liveness; an offer to take over is a fourth wall.
         */}
      </div>

      {unread > 0 && (
        <button type="button" className={s.newPill} onClick={jumpDown}>
          {unread} new ↓
        </button>
      )}

      {/*
       * The soft close only applies while the node is actually waiting.
       * During `playing` the beats are still arriving and the question
       * has not been asked yet, so closing the field then would be the
       * interface pre-empting itself.
       */}
      {/*
       * In the browser the composer shows the state it is IN — stood
       * down at a node that asked a closed question — rather than
       * inviting input into a specimen. Its own resting state is part of
       * what you came here to look at.
       */}
      <Composer
        ref={composer}
        locked={locked}
        constrained={inspected ? !!inspected.constrained : constrained}
        constrainedHint={
          (inspected ?? d.node).lines?.length
            ? 'Pick an answer above, or a line below'
            : 'Pick an answer above'
        }
        placeholder="Pick a line below to send"
        onSend={d.send}
        onStashChange={setHasStash}
      />
    </div>
  );

  if (!apparatus) return device;

  return (
    <Rig
      title={scenario.title}
      wallLabel={scenario.wallLabel}
      disclaimer={scenario.disclaimer}
      skin={skin}
      /*
       * Switching scenario also drops the state-browser entry point.
       *
       * `entry` is set when someone opens a state from All states, and
       * it names a node in whichever script was playing at the time.
       * Carried into a different script it is at best meaningless and
       * at worst the same stale-id crash the director now guards
       * against — so it is cleared here, where the change is initiated,
       * rather than inferred later.
       *
       * The conversation itself is reset inside the director, which
       * owns that state. This clears only what this component owns.
       */
      onSkin={(next) => {
        setEntry(undefined);
        setSkin(next);
      }}
      mode={mode}
      onMode={setMode}
      onRestart={() => {
        setEntry(undefined);
        setMode('play');
        d.restart();
      }}
      device={device}
      tray={
        <Tray
          /* The tray fills the composer and sends. Neither happens in the
             browser, and a line that fills nothing is a button that lies. */
          lines={!inspected && d.phase === 'waiting' ? (d.node.lines ?? []) : []}
          hasStash={hasStash}
          disabled={locked}
          onFill={fill}
          onRestore={() => composer.current?.restore()}
        />
      }
      index={
        <>
          {/*
           * Said out here, not inside the bezel. The product cannot
           * explain itself without breaking the fiction; the apparatus
           * exists precisely so something can.
           */}
          <p className={a.indexNote}>
            Each state on its own, outside the conversation. Your place in it is kept.
          </p>
          <div className={a.index}>
            {scenario.index.map((i) => (
              <button
                key={i.id}
                type="button"
                className={a.indexBtn}
                aria-current={inspect === i.id ? 'true' : undefined}
                /* Clicking the selected one again returns the device to
                   the conversation without closing the panel — the panel
                   is the visitor's to close. */
                onClick={() => setInspect((cur) => (cur === i.id ? null : i.id))}
              >
                {i.label}
                <small>{i.note}</small>
              </button>
            ))}
          </div>
        </>
      }
    />
  );
}
