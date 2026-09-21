/**
 * The boot mark: the apple silhouette the original showed here.
 *
 * Traced, not assembled. An earlier version unioned three ellipses, which
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
 * Stored at 110 x 126, which is the size it is DRAWN at.
 *
 * That is the whole reason it looks crisp, and it is also why resizing
 * the mark means REGENERATING it at the new size rather than turning
 * MARK_SCALE down. BootMark blits nearest neighbour, so a mark stored
 * larger than it is shown has rows and columns dropped on the way down:
 * one earlier version was 167x185 drawn at 0.75 and threw away a quarter
 * of its detail every frame, unevenly, which reads as a chewed edge
 * rather than a soft one.
 */

/** Dimensions in RASTER pixels — divide by the LCD scale for logical. */
export const MARK_W = 110;
export const MARK_H = 126;

const PACKED =
  'AAAAAAAAAAAAAcAAAAAAAAAAAAAAAAA/AAAAAAAAAAAAAAAAB/wAAAAAAAAAAAAAAAB/4AAAAAAA' +
  'AAAAAAAAA/+AAAAAAAAAAAAAAAA//gAAAAAAAAAAAAAAA//wAAAAAAAAAAAAAAAf/8AAAAAAAAAA' +
  'AAAAAP//AAAAAAAAAAAAAAAH//gAAAAAAAAAAAAAAD//4AAAAAAAAAAAAAAA//8AAAAAAAAAAAAA' +
  'AAf//AAAAAAAAAAAAAAAP//gAAAAAAAAAAAAAAH//4AAAAAAAAAAAAAAB//8AAAAAAAAAAAAAAA/' +
  '/+AAAAAAAAAAAAAAAP//AAAAAAAAAAAAAAAH//gAAAAAAAAAAAAAAB//wAAAAAAAAAAAAAAAf/4A' +
  'AAAAAAAAAAAAAAP/8AAAAAAAAAAAAAAAD/+AAAAAAAAAAAAAAAB/+AAAAAAAAAAAAAAAAf+AAAAA' +
  'AAAAAAAAAAAH+AAAAAAAAAAAAAAAAB+AAAAAAAAAAAAAPwAAcAAP/AAAAAAAAB//8AAAD///gAAA' +
  'AAAD///4AAP////AAAAAAD////AAP////8AAAAAD////8AP/////wAAAAB/////gP//////AAAAB' +
  '/////8H//////8AAAA//////j///////gAAAf/////9///////8AAAP//////////////gAAH///' +
  '///////////8AAD///////////////gAB///////////////8AA////////////////gAP//////' +
  '/////////4AH///////////////8AD///////////////+AA///////////////+AAf/////////' +
  '//////AAH///////////////gAD///////////////wAA///////////////4AAf////////////' +
  '//+AAH///////////////AAD///////////////gAA///////////////4AAf//////////////8' +
  'AAH///////////////AAB///////////////gAAf//////////////4AAP//////////////8AAD' +
  '///////////////AAA///////////////wAAf//////////////8AAH//////////////+AAB///' +
  '////////////gAAf//////////////4AAH//////////////+AAB///////////////gAAf/////' +
  '/////////4AAP//////////////+AAD///////////////gAA///////////////4AAP////////' +
  '//////+AAD///////////////gAA///////////////8AAP///////////////AAD///////////' +
  '////wAA///////////////8AAP///////////////gAD///////////////4AA//////////////' +
  '//AAP///////////////wAB///////////////+AAf///////////////gAH///////////////8' +
  'AB////////////////gAf///////////////4AH////////////////AB////////////////4AP' +
  '////////////////AD////////////////4A/////////////////gP////////////////8B///' +
  '//////////////wf/////////////////H/////////////////w/////////////////8P/////' +
  '////////////D/////////////////gf////////////////4H////////////////+B////////' +
  '/////////AP////////////////wD////////////////4Af///////////////+AH//////////' +
  '//////AA////////////////wAP///////////////4AB///////////////+AAP////////////' +
  '///AAD///////////////wAAf//////////////4AAD//////////////8AAA///////////////' +
  'AAAH//////////////gAAA//////////////wAAAH/////////////4AAAA/////////////8AAA' +
  'AP/////////////AAAAB/////////////gAAAAP////////////gAAAAB////////////wAAAAAH' +
  '///////////4AAAAAAf//////////4AAAAAAD//////////4AAAAAAAH///8H////4AAAAAAAAf/' +
  '/4AP///4AAAAAAAAAP/AAAf//gAAAAA=';

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
