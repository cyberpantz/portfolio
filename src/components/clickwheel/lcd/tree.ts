import { reconcile, type MenuItem, type MenuState } from './menu';
import type { Track } from '../useTracks';

/**
 * The menu tree, and the navigation over it.
 *
 * Kept apart from the component because it is pure data plus two pure
 * functions — which means it can be reasoned about and tested without a
 * canvas, a pointer, or React.
 *
 * The shape is a stack of frames rather than a flat "current screen":
 * MENU has to pop back to wherever you came from, and it has to restore
 * the row you were on when you left. A flat model loses that and drops
 * you at the top of the parent list every time, which is exactly the
 * thing that makes a recreated menu feel wrong.
 *
 * EVERY ROW HERE DOES SOMETHING. The first draft padded each node out to
 * the length of the real device's menus — Contacts, Calendar, Notes,
 * Games, Language, Legal — and every one of them was dead on a centre
 * press. A chevron is a promise that there is something behind it, and
 * eight rows that break that promise are worse than three that keep it.
 */

export type Leaf =
  /** Push a submenu. */
  | { kind: 'menu'; node: NodeId }
  /** Show a full-screen view — something that is not a list. */
  | { kind: 'screen'; screen: 'blob' | 'clock' | 'about' }
  /** Flip a setting and stay put. */
  | { kind: 'toggle'; key: 'backlight' }
  /** Play the track at this index and open Now Playing. */
  | { kind: 'track'; index: number };

export type Row = MenuItem & { go?: Leaf };
export type NodeId = 'root' | 'music' | 'extras' | 'settings';

export type Node = { title: string; rows: Row[] };

export const TREE: Record<NodeId, Node> = {
  root: {
    title: 'Click Wheel',
    rows: [
      { label: 'Music', chevron: true, go: { kind: 'menu', node: 'music' } },
      { label: 'Extras', chevron: true, go: { kind: 'menu', node: 'extras' } },
      { label: 'Settings', chevron: true, go: { kind: 'menu', node: 'settings' } },
      { label: 'Backlight', go: { kind: 'toggle', key: 'backlight' } },
    ],
  },
  /*
   * Empty on purpose until the audio engine lands: drawMenu renders "No
   * songs loaded" for a list with no rows, which is both true and what
   * the real device did with an empty library. Better than listing
   * Artists / Albums / Genres and having none of them open.
   */
  /*
   * Rows are supplied at runtime from the manifest, not listed here — see
   * frameToState. An empty list is not a placeholder: drawMenu renders
   * "No songs loaded" for it, which is the honest state before the fetch
   * lands and the correct one if the manifest is empty or unreachable.
   */
  music: { title: 'Music', rows: [] },
  extras: {
    title: 'Extras',
    rows: [
      { label: 'Twerkalizer', go: { kind: 'screen', screen: 'blob' } },
      { label: 'Clock', go: { kind: 'screen', screen: 'clock' } },
    ],
  },
  settings: {
    title: 'Settings',
    rows: [{ label: 'About', go: { kind: 'screen', screen: 'about' } }],
  },
};

export type Frame = { node: NodeId; selected: number; scroll: number };

/** Live values the tree needs in order to show state on a row. */
export type Flags = { backlight?: boolean };

/**
 * Rows for a node, with Music filled in from the manifest and any
 * stateful rows marked.
 *
 * The tree itself stays static data — a toggle's CURRENT value is not a
 * property of the menu, it is a property of the device, so it is passed
 * in here rather than written into TREE.
 */
export function rowsFor(node: NodeId, tracks: Track[] = [], flags: Flags = {}): Row[] {
  if (node === 'music') {
    return tracks.map((t, i) => ({ label: t.title, go: { kind: 'track', index: i } }));
  }
  return TREE[node].rows.map((r) =>
    r.go?.kind === 'toggle' && r.go.key === 'backlight'
      ? { ...r, check: !!flags.backlight }
      : r
  );
}

export function frameToState(f: Frame, tracks: Track[] = [], flags: Flags = {}): MenuState {
  return reconcile({
    title: TREE[f.node].title,
    items: rowsFor(f.node, tracks, flags),
    selected: f.selected,
    scroll: f.scroll,
  });
}

export function currentRow(f: Frame, tracks: Track[] = []): Row | undefined {
  return rowsFor(f.node, tracks)[f.selected];
}

/** Move the selection, clamped, with the scroll window following. */
export function moveSelection(f: Frame, dir: 1 | -1, tracks: Track[] = []): Frame {
  const st = frameToState({ ...f, selected: f.selected + dir }, tracks);
  return { ...f, selected: st.selected, scroll: st.scroll };
}
