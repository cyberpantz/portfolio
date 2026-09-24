import type { ReactNode } from 'react';
import type { ScenarioId } from '../scripts/types';
import a from './apparatus.module.css';

/**
 * The rig: wall label, device slot, tray, mode row.
 *
 * Inside the bezel is the product and it never winks. Outside is the
 * apparatus and it never pretends — which is why the disclosure lives
 * here, on first paint, rather than waiting for someone to ask whether
 * this is real.
 */

import { SCENARIO_LIST } from '../scripts';
import { ScenarioTabs } from './ScenarioTabs';

/*
 * The tabs list scenarios that exist, not skins that do.
 *
 * It used to offer Care / Family / Feline as pure token blocks, so two
 * of the three recoloured a conversation about an ear. Listing only what
 * is backed by a script is the same rule the chips follow: a control
 * that changes less than its label implies is lying.
 */
const SKINS = SCENARIO_LIST;

/*
 * Everything below the tabs is the panel they govern, which is why the
 * wall label and the disclaimer are inside it: both change with the
 * scenario, and a tabpanel that excluded them would tell a screen reader
 * the switch had done less than it did.
 */
const PANEL = 'sb-scenario-panel';

export type Mode = 'play' | 'watch' | 'index';

export function Rig({
  title,
  wallLabel,
  disclaimer,
  skin,
  onSkin,
  mode,
  onMode,
  onRestart,
  device,
  tray,
  index,
}: {
  title: string;
  wallLabel: string;
  disclaimer: { short: string; more: string };
  skin: ScenarioId;
  onSkin: (s: ScenarioId) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  onRestart: () => void;
  device: ReactNode;
  tray: ReactNode;
  index: ReactNode;
}) {
  return (
    <section className={a.rig} aria-label={`${title} demo`}>
      <ScenarioTabs value={skin} options={SKINS} onChange={onSkin} panelId={PANEL} />

      <div id={PANEL} role="tabpanel" aria-labelledby={`sb-tab-${skin}`}>
        <div className={a.wall}>
          <p className={a.wallBody}>{wallLabel}</p>
          {/*
           * Before the device, not after it — and collapsed.
           *
           * Three sentences above a convincing interface is a wall, and a
           * wall gets skipped. One line always shows, which is the part
           * that has to survive a glance; the rest is for the person who
           * stopped to check, and they will open it.
           *
           * `<details>` rather than a React toggle: the browser already
           * has keyboard handling, the right roles, expanded state for a
           * screen reader, and find-in-page that can open it. A hand-built
           * disclosure would be a worse copy of all four.
           */}
          <details className={a.disclaimer}>
            <summary className={a.disclaimerHead}>
              <span>{disclaimer.short}</span>
              {/*
               * Two spans rather than swapping text, so the label can
               * change without JavaScript. aria-hidden because the
               * summary's own expanded state already announces this.
               */}
              <span className={a.disclaimerToggle} aria-hidden="true">
                <span data-when="closed">Read more</span>
                <span data-when="open">Less</span>
              </span>
            </summary>
            <p className={a.disclaimerBody}>{disclaimer.more}</p>
          </details>
        </div>

        <div className={a.deviceSlot}>{device}</div>

        {tray}

        <div className={a.bar} style={{ marginTop: 12, marginBottom: 0 }} role="group" aria-label="Mode">
          <span className={a.barLabel} aria-hidden="true">
            Mode
          </span>
          {/*
           * All states leads.
           *
           * It was third, in the same weight as Replay. It is the most
           * interesting control on the page — the whole component browser
           * is behind it — and the ordering was a leftover from when it
           * was a debugging aid rather than a feature. First position, and
           * the one control given ink rather than mute, because the rest
           * of the row is housekeeping.
           */}
          <button
            type="button"
            className={`${a.tab} ${a.tabLead}`}
            aria-pressed={mode === 'index'}
            onClick={() => onMode(mode === 'index' ? 'play' : 'index')}
          >
            All states
          </button>
          <button
            type="button"
            className={a.tab}
            aria-pressed={mode === 'watch'}
            onClick={() => onMode(mode === 'watch' ? 'play' : 'watch')}
          >
            {mode === 'watch' ? 'Stop watching' : '▶ Watch it play'}
          </button>
          <button type="button" className={a.tab} onClick={onRestart}>
            Start over
          </button>
        </div>

        {mode === 'index' && index}
      </div>
    </section>
  );
}
