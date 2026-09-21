/**
 * The boot mark: the apple silhouette the original showed here.
 *
 * Traced, not assembled. The first version unioned three ellipses, which
 * left visible seams where the lobes met and could not produce either the
 * cleft in the bottom edge or a leaf that floats clear of the body — and
 * that gap under the leaf is most of what makes the real mark readable.
 * This is one closed bezier outline for the body, one subtracted circle
 * for the bite, and a separate lens of two quadratics for the leaf.
 *
 * Measured off the reference in an 880 x 990 design space, so the numbers
 * are recoverable: cleft at (420,295), leftmost (5,520), bottom cleft at
 * (420,965), rightmost (884,540), bite circle centred (938,530) radius
 * 221 — solved from three points read off the reference edge — and a leaf
 * 310 long by 105 wide at -46 degrees with its lower tip at (420,235),
 * sixty units clear of the cleft.
 *
 * Stored at 129 x 148, which is the size it is DRAWN at.
 *
 * That is the whole reason it looks crisp. BootMark blits nearest
 * neighbour, so a mark stored larger than it is shown gets rows and
 * columns dropped on the way down — the previous one was 167x185 shown at
 * 0.75, and every frame threw away a quarter of its detail unevenly.
 * Stored at display size with MARK_SCALE at 1, the resting frame is a
 * 1:1 copy and the only resampling left is during the bounce, where it
 * is motion and nobody can see it.
 */

/** Dimensions in RASTER pixels — divide by the LCD scale for logical. */
export const MARK_W = 129;
export const MARK_H = 148;

const PACKED =
  'AAAAAAAAAAAAAAAHAAAAAAAAAAAAAAAAAAAAP4AAAAAAAAAAAAAAAAAAAH+AAAAAAAAAAAAAAAAA' +
  'AAD/wAAAAAAAAAAAAAAAAAAB/+AAAAAAAAAAAAAAAAAAA//wAAAAAAAAAAAAAAAAAAP/8AAAAAAA' +
  'AAAAAAAAAAAH//gAAAAAAAAAAAAAAAAAB//8AAAAAAAAAAAAAAAAAAf//AAAAAAAAAAAAAAAAAAH' +
  '//4AAAAAAAAAAAAAAAAAB//+AAAAAAAAAAAAAAAAAAf//wAAAAAAAAAAAAAAAAAH//8AAAAAAAAA' +
  'AAAAAAAAB///gAAAAAAAAAAAAAAAAAf//4AAAAAAAAAAAAAAAAAD///AAAAAAAAAAAAAAAAAA///' +
  'wAAAAAAAAAAAAAAAAAH//+AAAAAAAAAAAAAAAAAB///gAAAAAAAAAAAAAAAAAP//4AAAAAAAAAAA' +
  'AAAAAAD//+AAAAAAAAAAAAAAAAAAf//gAAAAAAAAAAAAAAAAAH//4AAAAAAAAAAAAAAAAAA//+AA' +
  'AAAAAAAAAAAAAAAAH//gAAAAAAAAAAAAAAAAAB//wAAAAAAAAAAAAAAAAAAP/8AAAAAAAAAAAAAA' +
  'AAAAB/+AAAAAAAAAAAAAAAAAAAf/AAAAAAAAAAAAAAAAAAAD/gAAAAAAAAAAAAAAAAAAAfwAAAAA' +
  'AAAAAAAAAAPwAADgAAH/wAAAAAAAAAB//+AAAAB///+AAAAAAAAB///+AAAD////+AAAAAAAB///' +
  '/8AAD/////+AAAAAAAf////4AB//////8AAAAAAP/////wA///////wAAAAAD//////AP///////' +
  'gAAAAB//////8H///////+AAAAAf//////x////////8AAAAH///////f////////wAAAB//////' +
  '///////////AAAAf////////////////8AAAH/////////////////wAAB//////////////////' +
  'AAAf/////////////////8AAH//////////////////gAA//////////////////+AAP////////' +
  '//////////wAD//////////////////4AAf/////////////////+AAH//////////////////gA' +
  'B//////////////////4AAP/////////////////8AAD//////////////////gAAf//////////' +
  '///////4AAH/////////////////+AAA//////////////////gAAP/////////////////4AAB/' +
  '/////////////////AAAP/////////////////wAAD/////////////////8AAAf////////////' +
  '/////gAAD/////////////////4AAA//////////////////AAAH/////////////////4AAA///' +
  '//////////////+AAAP/////////////////wAAB/////////////////+AAAP//////////////' +
  '///gAAB/////////////////8AAAf/////////////////gAAD/////////////////8AAAf////' +
  '/////////////gAAD/////////////////8AAAf/////////////////gAAD////////////////' +
  '/4AAAf/////////////////AAAH/////////////////4AAA//////////////////gAAH//////' +
  '///////////8AAA//////////////////gAAH/////////////////8AAA//////////////////' +
  'gAAH/////////////////8AAA//////////////////gAAH/////////////////+AAA////////' +
  '//////////wAAH/////////////////+AAA//////////////////4AAH//////////////////A' +
  'AA//////////////////8AAD//////////////////gAAf/////////////////+AAD/////////' +
  '/////////wAAf//////////////////AAD//////////////////8AAf//////////////////gA' +
  'D//////////////////+AAf//////////////////4AB///////////////////gAP//////////' +
  '////////+AB///////////////////4AP///////////////////gA///////////////////+AH' +
  '///////////////////8A////////////////////4H////////////////////wf///////////' +
  '/////////D////////////////////4f///////////////////+B////////////////////wP/' +
  '//////////////////+B////////////////////gH///////////////////8A/////////////' +
  '///////AD///////////////////4Af///////////////////AB///////////////////wAP//' +
  '////////////////+AA///////////////////gAH//////////////////8AA//////////////' +
  '/////AAD//////////////////4AAP/////////////////+AAB//////////////////wAAH///' +
  '//////////////8AAAf/////////////////AAAD/////////////////4AAAP//////////////' +
  '//+AAAA/////////////////gAAAH////////////////4AAAAf////////////////AAAAB////' +
  '////////////wAAAAH///////////////8AAAAAf///////////////AAAAAB///////////////' +
  'wAAAAAH//////////////8AAAAAAf//////////////AAAAAAB//////////////wAAAAAAH////' +
  '/////////4AAAAAAAP////////////+AAAAAAAA/////////////AAAAAAAAB/////7//////gAA' +
  'AAAAAAB////4D/////wAAAAAAAAAB///wAD////wAAAAAAAAAAA//AAAB///gAAAAAA=';

let unpacked: Uint8Array | null = null;

/** Lazily expand the packed rows to one byte per pixel. */
export function markBits(): Uint8Array {
  if (unpacked) return unpacked;
  const bin = atob(PACKED);
  const out = new Uint8Array(MARK_W * MARK_H);
  for (let i = 0; i < out.length; i++) {
    out[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  }
  unpacked = out;
  return out;
}
