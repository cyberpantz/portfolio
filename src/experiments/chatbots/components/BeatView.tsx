import type { Beat, Chip } from '../scripts/types';
import { Thinking } from './Thinking';
import { Reframe, Safety } from './Safety';
import {
  Boundary,
  Chips,
  Compare,
  Disclosure,
  EmptyPivot,
  Picker,
  Recommendation,
  Results,
  Scheduler,
  SystemError,
} from './Cards';
import { Appointment } from './Appointment';
import { TimeGrid } from './TimeGrid';
import { Scale } from './Scale';
import s from './product.module.css';

/**
 * One beat → one component.
 *
 * The switch is exhaustive against the Beat union, with a `never` guard,
 * so adding a beat type without rendering it is a COMPILE error rather
 * than a blank space someone notices in review. That is the only reason
 * Beat is a discriminated union.
 */
export type BeatHandlers = {
  choose: (c: Chip) => void;
  pick: (label: string, to: string) => void;
  go: (id: string) => void;
  /** Chips pulse once at 12s idle, then the offer arrives at 25s. */
  pulse?: boolean;
  /**
   * The label the visitor picked from THIS beat, once they have.
   *
   * Controls stay in the transcript after they are used — a chat keeps
   * its history, and the chips are part of the turn they belonged to.
   * But they stayed fully lit and fully clickable, so a question
   * answered four turns ago still looked live and would re-fire if
   * clicked. Knowing which one was taken lets the row settle: the answer
   * marked, the rest receding, none of them still asking.
   */
  chosen?: string;
  /** A time chosen from a grid, for an appointment that says `@picked`. */
  picked?: { at: string; day: 'today' | 'tomorrow' };
  /** Grid cell chosen: carries the machine time as well as the label. */
  time?: (at: string, label: string, day: string, go: string) => void;
};

export function BeatView({
  beat,
  grouped,
  h,
}: {
  beat: Beat;
  grouped: boolean;
  h: BeatHandlers;
}) {
  switch (beat.t) {
    case 'say':
      return (
        <div className={[s.ai, grouped ? s.grouped : ''].filter(Boolean).join(' ')} data-bubble>
          {beat.text}
        </div>
      );

    case 'ack':
      return <div className={s.ack}>{beat.text}</div>;

    case 'think':
      return (
        <Thinking
          stages={beat.stages}
          facts={beat.facts}
          ms={beat.ms}
          failAt={beat.failAt}
          slowNote={beat.slowNote}
          exitLabel={beat.exitLabel}
          onExit={beat.exitGo ? () => h.go(beat.exitGo!) : undefined}
        />
      );

    case 'chips':
      return (
        <Chips options={beat.options} onChoose={h.choose} pulse={h.pulse} chosen={h.chosen} />
      );

    case 'pick':
      return (
        <Picker
          spec={beat.spec}
          chosen={h.chosen}
          onPick={(label, _v, go) => h.pick(label, go ?? beat.go)}
        />
      );

    case 'scale':
      return (
        <Scale
          steps={beat.steps}
          chosen={h.chosen}
          onPick={(label) => h.pick(label, beat.go)}
        />
      );

    case 'compare':
      return <Compare title={beat.title} axes={beat.axes} rows={beat.rows} />;

    case 'recommend':
      return <Recommendation why={beat.why} confidence={beat.confidence} />;

    case 'disclose':
      return <Disclosure summary={beat.summary} rows={beat.rows} />;

    case 'results':
      return <Results items={beat.items} />;

    case 'empty':
      return (
        <EmptyPivot
          constraint={beat.constraint}
          title={beat.title}
          alternatives={beat.alternatives}
          chosen={h.chosen}
          onChoose={(label, go) => h.pick(label, go ?? '')}
        />
      );

    case 'schedule':
      return <Scheduler slots={beat.slots} onPick={h.pick} chosen={h.chosen} />;

    case 'timegrid':
      return (
        <TimeGrid
          title={beat.title}
          days={beat.days}
          chosen={h.chosen}
          onPick={(t, day) => h.time?.(t.at, t.label, day, beat.go)}
        />
      );

    case 'appointment':
      return (
        /*
         * `@picked` resolves here rather than in the component, so the
         * Appointment stays a dumb renderer that knows nothing about
         * grids — the same component still serves the vet and the
         * therapist.
         */
        <Appointment
          title={beat.title}
          day={beat.day === '@picked' ? (h.picked?.day ?? 'today') : beat.day}
          time={beat.time === '@picked' ? (h.picked?.at ?? '09:00') : beat.time}
          minutes={beat.minutes}
          location={beat.location}
          prep={beat.prep}
        />
      );

    case 'reframe':
      return (
        <Reframe
          headline={beat.headline}
          body={beat.body}
          options={beat.options}
          onChoose={h.choose}
        />
      );

    case 'boundary':
      return <Boundary refusal={beat.refusal} instead={beat.instead} />;

    case 'safety':
      return (
        <Safety
          tempo={beat.tempo}
          headline={beat.headline}
          body={beat.body}
          action={beat.action}
          alt={beat.alt}
          footnote={beat.footnote}
          onAlt={h.choose}
        />
      );

    case 'error':
      return (
        <SystemError
          stages={beat.stages}
          stage={beat.stage}
          message={beat.message}
          escape={beat.escape}
          onRetry={() => h.go(beat.retry)}
          onEscape={() => h.go(beat.escape.go ?? 'phones')}
        />
      );

    default: {
      const _exhaustive: never = beat;
      throw new Error(`unhandled beat: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
