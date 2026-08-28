import { assertValidQuiz, type Quiz } from './types';

/**
 * Nine questions. Four are answered by looking at type rather than
 * reading about it — that is the whole reason the `specimen` kind
 * exists, and the reason this quiz is the one worth showing a design
 * technologist.
 *
 * Every specimen choice carries `describedAs`: a factual description
 * that lets someone answer without seeing the type, without giving
 * the answer away. "Extreme thick-to-thin contrast" is a description;
 * "the Didone one" would be a giveaway.
 */
export const typography: Quiz = assertValidQuiz({
  id: 'typography',
  title: 'Typography',
  blurb:
    'Nine questions about type. Several are answered by looking rather than reading, which is the point.',
  fonts: ['Bodoni Moda', 'Archivo', 'EB Garamond', 'Libre Franklin'],
  questions: [
    {
      id: 'kerning-pair',
      kind: 'specimen',
      prompt: 'One of these was kerned. One was left to chance.',
      choices: [
        {
          id: 'unkerned',
          label: 'AVATAR',
          specimen: { fontFamily: 'Bodoni Moda', letterSpacing: '0.02em' },
          describedAs: 'AVATAR with a visible gap between the A and V, and between T and A.',
          postLabel: 'Default metrics',
        },
        {
          id: 'kerned',
          label: 'AVATAR',
          specimen: {
            fontFamily: 'Bodoni Moda',
            letterSpacing: '0.02em',
            // Tighten after A (index 0) and after T (index 3)
            pairKerning: { 0: '-0.07em', 3: '-0.05em' },
          },
          describedAs: 'AVATAR with the A-V and T-A pairs closed up so the spacing looks even.',
          postLabel: 'Kerned',
        },
      ],
      correctId: 'kerned',
      reveal:
        'Diagonal pairs — AV, AW, TA, VA — open gaps the metrics do not close. Kerning is what closes them.',
    },
    {
      id: 'en-dash',
      kind: 'text',
      prompt: 'Which mark belongs in 1998–2004?',
      choices: [
        { id: 'hyphen', label: 'Hyphen  -' },
        { id: 'en', label: 'En dash  –' },
        { id: 'em', label: 'Em dash  —' },
        { id: 'minus', label: 'Minus  −' },
      ],
      correctId: 'en',
      reveal:
        'En dash for ranges. The hyphen is doing someone else’s job and the em dash is having a lie down.',
    },
    {
      id: 'didone',
      kind: 'specimen',
      prompt: 'Which of these is a Didone?',
      choices: [
        {
          id: 'garamond',
          label: 'Modern',
          specimen: { fontFamily: 'EB Garamond' },
          describedAs: 'Modern with gentle stroke contrast and angled, bracketed serifs.',
          postLabel: 'EB Garamond — old style',
        },
        {
          id: 'bodoni',
          label: 'Modern',
          specimen: { fontFamily: 'Bodoni Moda' },
          describedAs:
            'Modern with extreme thick-to-thin contrast and flat hairline serifs meeting the stem at a right angle.',
          postLabel: 'Bodoni Moda — Didone',
        },
        {
          id: 'franklin',
          label: 'Modern',
          specimen: { fontFamily: 'Libre Franklin' },
          describedAs: 'Modern with even stroke weight and no serifs.',
          postLabel: 'Libre Franklin — grotesque',
        },
        {
          id: 'archivo',
          label: 'Modern',
          specimen: { fontFamily: 'Archivo' },
          describedAs: 'Modern with even stroke weight, no serifs, and a slightly narrower set.',
          postLabel: 'Archivo — grotesque',
        },
      ],
      correctId: 'bodoni',
      reveal:
        'Extreme thick-to-thin contrast, hairline serifs at right angles, vertical stress. Didones were the 1790s deciding that print could be sharp now.',
    },
    {
      id: 'kern-vs-track',
      kind: 'text',
      prompt: 'The space between two specific letters is called—',
      choices: [
        { id: 'kerning', label: 'Kerning' },
        { id: 'tracking', label: 'Tracking' },
        { id: 'leading', label: 'Leading' },
        { id: 'hinting', label: 'Hinting' },
      ],
      correctId: 'kerning',
      reveal:
        'Kerning is a pair. Tracking is the whole line. People will use them interchangeably at you for the rest of your career.',
    },
    {
      id: 'fake-italic',
      kind: 'specimen',
      prompt: 'One of these italics is real. The other is a roman that got pushed over.',
      choices: [
        {
          id: 'true',
          label: 'Regarding',
          specimen: { fontFamily: 'EB Garamond', fontStyle: 'italic' },
          describedAs:
            'Regarding in letterforms that have been redrawn — the a is single-storey and the strokes curve into the slant.',
          postLabel: 'A drawn italic',
        },
        {
          id: 'fake',
          label: 'Regarding',
          specimen: { fontFamily: 'EB Garamond', skewX: -12 },
          describedAs:
            'Regarding in upright letterforms that have been sheared over — the a keeps its two-storey shape and the curves are distorted.',
          postLabel: 'A sheared roman',
        },
      ],
      correctId: 'true',
      reveal:
        'A real italic is redrawn, not leaned. Look at the a — the true one changed shape; the fake one just fell.',
    },
    {
      id: 'x-height',
      kind: 'specimen',
      prompt: 'Which has the largest x-height?',
      aside: 'All four are set at exactly the same point size.',
      choices: [
        {
          id: 'garamond',
          label: 'Height',
          specimen: { fontFamily: 'EB Garamond' },
          describedAs: 'Height in a face whose lowercase is small relative to its capitals.',
          postLabel: 'EB Garamond — smallest',
        },
        {
          id: 'bodoni',
          label: 'Height',
          specimen: { fontFamily: 'Bodoni Moda' },
          describedAs: 'Height in a face whose lowercase is moderate relative to its capitals.',
          postLabel: 'Bodoni Moda',
        },
        {
          id: 'archivo',
          label: 'Height',
          specimen: { fontFamily: 'Archivo' },
          describedAs: 'Height in a face whose lowercase is large relative to its capitals.',
          postLabel: 'Archivo — largest',
        },
        {
          id: 'franklin',
          label: 'Height',
          specimen: { fontFamily: 'Libre Franklin' },
          describedAs: 'Height in a face whose lowercase is fairly large relative to its capitals.',
          postLabel: 'Libre Franklin',
        },
      ],
      correctId: 'archivo',
      reveal:
        'X-height drives apparent size far more than point size does. Two faces at 16px can differ by a third in how big they look.',
    },
    {
      id: 'leading',
      kind: 'text',
      prompt: 'Leading is named after—',
      choices: [
        { id: 'lead', label: 'Strips of lead placed between lines' },
        { id: 'leading-edge', label: 'The leading edge of a letterform' },
        { id: 'lead-line', label: 'The lead line of a paragraph' },
        { id: 'acronym', label: 'Nothing, it is an acronym' },
      ],
      correctId: 'lead',
      reveal:
        'Actual lead, placed between lines of metal type. Which is why it rhymes with sledding and not with reading.',
    },
    {
      id: 'comic-sans',
      kind: 'text',
      prompt: 'Comic Sans was originally drawn for—',
      choices: [
        { id: 'dog', label: 'A cartoon dog in Microsoft Bob' },
        { id: 'hospital', label: "A children's hospital" },
        { id: 'ransom', label: 'A ransom note generator' },
        { id: 'errors', label: 'Windows 95 error dialogs' },
      ],
      correctId: 'dog',
      reveal:
        'Vincent Connare drew it in 1994 for Rover, a cartoon dog in Microsoft Bob. It escaped, and it has never once been caught.',
    },
    {
      id: 'widow',
      kind: 'text',
      prompt: 'A single word stranded on the last line of a paragraph is a—',
      choices: [
        { id: 'widow', label: 'Widow' },
        { id: 'orphan', label: 'Orphan' },
        { id: 'runt', label: 'Runt' },
        { id: 'rag', label: 'Rag' },
      ],
      correctId: 'widow',
      reveal:
        'A widow is left behind at the end. An orphan is alone at the start. Both are your problem.',
    },
  ],
  results: [
    {
      min: 9,
      title: 'Kerned By Hand',
      body: 'Nine for nine. You have opinions about hyphens and you have been waiting years for someone to ask.',
    },
    {
      min: 7,
      title: 'Type Director',
      body: 'You would catch a fake italic on a billboard from a moving car.',
    },
    {
      min: 5,
      title: 'Knows A Serif',
      body: 'Solid working knowledge. You would not embarrass yourself in a type review, which is more than most.',
    },
    {
      min: 3,
      title: 'Needs Tracking',
      body: 'You have absorbed some of this by proximity. The rest is in a book, and the book is short.',
    },
    {
      min: 0,
      title: 'Set In Default',
      body: 'Nine questions, four options each. The arithmetic here is not flattering.',
    },
  ],
});
