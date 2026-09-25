import type { Scenario } from './types';
import { BASE } from './lexicon';

/**
 * Feline Forensics — the second scenario, and the proof.
 *
 * Everything the spec claims about this being an engine was, until this
 * file existed, an assertion with one script under it. A viewer could not
 * tell an engine from a stylesheet, because switching the theme changed
 * the colours and the conversation carried on talking about an ear.
 *
 * Nothing here is a new component. Same beats, same director, same
 * safety apparatus, same grid. What changes is data:
 *
 *   voice.humour      0.3 → 0.8   the joke is the reason people stay
 *   voice.address     self → proxy-nonverbal
 *   lexicon           ears and fevers → string and lilies
 *   safety            cardiac/stroke → ingestion, which is the feline
 *                     equivalent: sudden, time-limited, and the wrong
 *                     thing to schedule an appointment for
 *
 * The address change is the interesting one. Care can ask "where does it
 * hurt?" because the subject can answer. A cat cannot, so every question
 * here is about WHEN and WHERE and WHAT CHANGED — evidence rather than
 * sensation. That constraint is what the picker was built for in the
 * first place, and it is why this scenario is the honest second one
 * rather than a re-skin of the first.
 */
export const FELINE: Scenario = {
  id: 'feline',
  title: 'Feline Forensics',
  /*
   * Written like a person, on the third try.
   *
   * First it was a note about the machinery — "the same engine, a
   * different world" — which is the right fact at the wrong altitude.
   * Then it became "a simulated AI behaviour consultation, where the
   * patient cannot describe a symptom", which is a sentence from a
   * medical journal about a cat knocking things off a shelf. Accurate,
   * abstract, and nothing like how anyone would describe this out loud.
   *
   * The reach for clinical register is the tell: naming the design
   * constraint ("a non-verbal subject") instead of the situation ("he
   * won't explain himself") sounds rigorous and reads as stiff. Say the
   * situation. The constraint is visible in it anyway.
   */
  wallLabel:
    'A simulated chat about why a cat is wrecking the place. A fun way to explore various states that conversational interfaces must handle.',

  disclaimer: {
    short: 'Not veterinary advice.',
    more: 'Everything here is invented for a portfolio piece, including the emergency screen. A cat that is actually unwell needs an actual vet.',
  },

  /*
   * Humour at 0.8 is not licence to be funnier in general. It means the
   * jokes carry weight the copy would otherwise have to spend elsewhere:
   * nobody is frightened here, so charm is what keeps a person typing.
   * The safety screen ignores this entirely, as it must.
   */
  voice: { humour: 0.8, acknowledgment: 'required', address: 'proxy-nonverbal' },

  stripLabel: 'What this is about',
  narrowing: 'eliminate',
  options: [
    { id: 'medical', label: 'Medical', icon: 'urgent' },
    { id: 'boredom', label: 'Under-stimulated', icon: 'tele' },
    { id: 'territory', label: 'Territorial', icon: 'primary' },
    { id: 'litter', label: 'Litter box', icon: 'er' },
  ],

  /*
   * Ingestion, not chest pain — but the same shape of rule: sudden, time
   * limited, and the wrong thing to book an appointment about. Proof that
   * safety is a scenario's own list rather than a hard-coded medical
   * special case.
   */
  safety: [
    {
      id: 'string',
      tempo: 1,
      test: (s) =>
        /(string|thread|tinsel|ribbon|floss|hair tie|elastic)/i.test(s) &&
        /(ate|eaten|swallow|chewed|gone|missing)/i.test(s),
      go: 'vet-now',
    },
    {
      id: 'lily',
      tempo: 1,
      test: (s) => /(lily|lilies|antifreeze|paracetamol|ibuprofen|tylenol)/i.test(s),
      go: 'vet-now',
    },
  ],

  lexicon: {
    ...BASE,
    symptomPatterns: [],
    keywords: [
      'cat', 'kitten', 'sofa', 'couch', 'scratch', 'scratching', 'bite', 'biting',
      'litter', 'spray', 'yowl', 'yowling', 'meow', 'vet', 'chewing', 'knocking',
    ],
  },

  topics: ['he|him|his', 'sofas?'],

  /*
   * Its own list, because the browser used to offer one hard-coded set
   * of care states to every scenario — a feline conversation advertising
   * "Dictation" and "Third strike", neither of which it contains.
   */
  index: [
    { id: 'open', label: 'Cold open', note: 'empty state' },
    { id: 'extract', label: 'Thinking', note: 'extraction' },
    { id: 'when', label: 'Evidence', note: 'when, not where' },
    { id: 'no-pattern', label: 'No pattern', note: 'uncertainty as a finding' },
    { id: 'territory-check', label: 'Resolved', note: 'the receipt' },
    { id: 'scene', label: 'Sofa map', note: 'picker + diagram' },
    { id: 'damage', label: 'Severity', note: 'scale' },
    { id: 'options', label: 'Compare', note: 'table of options' },
    { id: 'plan', label: 'The plan', note: 'results list' },
    { id: 'vet-soon', label: 'All times', note: 'grid \u00b7 days \u00d7 hours' },
    { id: 'booked', label: 'Booked', note: 'completion' },
    { id: 'vet-now', label: 'Emergency', note: 'tempo 1 \u00b7 halt' },
  ],

  start: 'open',

  nodes: {
    open: {
      id: 'open',
      /*
       * An intro, because a cold open cannot assume three things at once.
       *
       * It opened on "Tell me what he is doing." — which takes for
       * granted that you have a cat, that the cat is male, and that the
       * assistant already knows which "he" it means. The care script
       * gets away with a bare invitation because a triage tool has an
       * obvious premise; "Feline Forensics" does not explain its own
       * method, so it has to.
       *
       * The first line states the method rather than the name. Naming
       * itself would repeat the heading directly above it, and the four
       * categories are the strip's own options — so the intro tells you
       * what the interface is about to do AND what the readout will
       * mean, in one sentence.
       *
       * "Your cat" rather than "he": the gender arrives from the
       * visitor's own line, which is the only place it can honestly come
       * from.
       */
      say: [
        { t: 'say', text: 'What has your cat been up to?' },
      ],
      lines: [
        {
          id: 'sofa',
          preview: 'He has destroyed the sofa.',
          text: 'He has destroyed the sofa.',
          words: 5,
          go: 'scene',
        },
        {
          id: 'messy',
          preview: 'ok so at 4am he begins. the Hour of Power…',
          text: 'ok so at 4am he begins. the Hour of Power. he sprints the length of the flat, screams once at the radiator, and then knocks a single object off a shelf while maintaining eye contact. he has done this for six nights. the sofa is a secondary casualty. he is otherwise in excellent spirits, which is the insulting part.',
          words: 57,
          go: 'extract',
        },
        {
          /*
           * The safety line, and it is a tray line for the same reason
           * the cardiac one is: an emergency screen nobody can reach is
           * the least defensible thing in a piece about handling states.
           * Caught by the rule on the way, not routed there directly.
           */
          id: 'string',
          preview: 'i think he ate a bit of string off the roast',
          text: 'i think he ate a bit of string off the roast',
          words: 10,
          go: 'vet-now',
        },
      ],
      accept: [
        { on: 'line', id: 'sofa', go: 'scene' },
        { on: 'line', id: 'messy', go: 'extract' },
        { on: 'line', id: 'string', go: 'vet-now' },
      ],
    },

    extract: {
      id: 'extract',
      say: [
        {
          t: 'think',
          stages: ['Reading', 'Pulling out what matters', 'Checking the usual suspects'],
          facts: ['4am', 'six nights', 'vocal', 'knocking things off', 'otherwise well'],
          ms: 2600,
        },
      ],
      auto: 'recap',
    },

    /*
     * The read-back belongs to the paste, exactly as in the care script —
     * the same mistake was available here and the same split avoids it.
     */
    recap: {
      id: 'recap',
      say: [
        {
          t: 'say',
          text: 'Six nights, same hour, and he is thriving. That is not a cat in pain — that is a cat with a schedule.',
        },
        { t: 'say', text: 'The eye contact is editorial.', hold: 420 },
      ],
      auto: 'when',
    },

    /*
     * WHEN, not where. The whole scenario turns on this: the subject
     * cannot report a sensation, so every question has to be about
     * evidence a human can observe.
     */
    when: {
      id: 'when',
      constrained: true,
      say: [
        { t: 'think', stages: ['Thinking'], ms: 900 },
        { t: 'say', text: 'When does it happen?' },
        {
          t: 'chips',
          options: [
            { label: 'Always at night', go: 'nocturnal' },
            { label: 'When we leave', go: 'alone' },
            { label: 'No pattern I can see', go: 'no-pattern', safe: true },
          ],
        },
      ],
      accept: [
        { on: 'chip', value: 'Always at night', go: 'nocturnal' },
        { on: 'chip', value: 'When we leave', go: 'alone' },
        { on: 'chip', value: 'No pattern I can see', go: 'no-pattern' },
      ],
    },

    /*
     * Two components that existed for weeks with nothing rendering them.
     *
     * `scale` and `compare` were built, typed and covered by a
     * placeholder test, and the care script never found an honest use
     * for either — a triage tool asking you to rate pain 1–10 is the
     * cliché the whole piece was avoiding. Damage assessment is
     * different: the severity genuinely is a spectrum, nobody is
     * frightened, and a comparison table of three interventions is the
     * kind of thing a person actually wants.
     *
     * Which is the argument for an engine, made concretely: the second
     * script did not need new components, it needed the ones already
     * there to finally have a world that suited them.
     */
    /*
     * The sofa map — the ear picker's twin, and the joke that earns it.
     *
     * "Where, exactly?" is the question a chat bubble asks worst: nobody
     * types "the front outside corner of the left arm". It is also the
     * cheapest possible proof that the picker is a component rather than
     * a medical illustration with a component attached — same beat, same
     * props, a different drawing.
     *
     * Every region leads to the same next question, exactly as the ear
     * does: where they went at it changes the anecdote, not the advice.
     */
    /*
     * The sofa questions belong to the sofa complaint, and only to it.
     *
     * They sat in the middle of the flow, so every branch fell through
     * them — including the 4am paste, where the sofa is named exactly
     * once and as "a secondary casualty". Being asked to point at the
     * worst of the damage, and then to rate it, when you came in about a
     * cat screaming at a radiator is the interface following its own
     * script rather than the conversation.
     *
     * So the sofa line comes straight here and the behaviour interview
     * follows; everything else skips to the comparison. The two tray
     * lines now genuinely lead different ways, which is the whole point
     * of offering two.
     */
    scene: {
      id: 'scene',
      constrained: true,
      say: [
        { t: 'say', text: 'Show me where. Be honest.' },
        {
          t: 'pick',
          go: 'damage',
          spec: {
            prompt: 'Tap the worst of it.',
            diagram: 'sofa',
            choices: [
              { label: 'The arms', value: 'arms' },
              { label: 'The back', value: 'back' },
              { label: 'The cushions', value: 'seat' },
              { label: 'Underneath, somehow', value: 'under' },
            ],
          },
        },
      ],
      accept: [{ on: 'pick', value: '*', go: 'damage' }],
    },

    damage: {
      id: 'damage',
      constrained: true,
      say: [
        { t: 'say', text: 'And how bad, honestly?' },
        {
          t: 'scale',
          steps: ['A few threads', 'Noticeable', 'Bad', 'Structural'],
          go: 'when',
        },
      ],
      accept: [{ on: 'chip', value: '*', go: 'when' }],
    },

    options: {
      id: 'options',
      constrained: true,
      say: [
        { t: 'ack', text: 'Noted.' },
        {
          t: 'compare',
          title: 'Three ways this goes',
          axes: ['Cost', 'Effort', 'Works'],
          rows: [
            { label: 'Scratching post', cells: ['$40', 'One evening', 'Usually'] },
            { label: 'Cat tree by the window', cells: ['$120', 'An afternoon', 'Reliably'] },
            { label: 'Hoping he stops', cells: ['$0', 'None', 'No'] },
          ],
        },
        {
          t: 'chips',
          options: [
            { label: 'Give me the plan', go: 'plan' },
            { label: 'I would rather a vet looked at him', go: 'vet-soon' },
          ],
        },
      ],
      accept: [
        { on: 'chip', value: 'Give me the plan', go: 'plan' },
        { on: 'chip', value: 'I would rather a vet looked at him', go: 'vet-soon' },
      ],
    },

    nocturnal: {
      id: 'nocturnal',
      constrained: true,
      effect: { strip: { out: ['litter'], lead: 'boredom' } },
      say: [
        {
          t: 'say',
          text: 'Cats do not have insomnia. They have unfinished business.',
        },
        { t: 'say', text: 'Has anything changed in the last week or two?' },
        {
          t: 'chips',
          options: [
            { label: 'We moved a cat tree', go: 'territory-check' },
            { label: 'Nothing changed', go: 'options' },
            { label: 'Not that I noticed', go: 'options', safe: true },
          ],
        },
      ],
      accept: [
        { on: 'chip', value: 'We moved a cat tree', go: 'territory-check' },
        { on: 'chip', value: 'Nothing changed', go: 'options' },
        { on: 'chip', value: 'Not that I noticed', go: 'options' },
      ],
    },

    alone: {
      id: 'alone',
      constrained: true,
      effect: { strip: { out: ['litter', 'medical'], lead: 'boredom' } },
      say: [
        { t: 'say', text: 'Then it is about your leaving, not the sofa.' },
        { t: 'say', text: 'Is the damage always in the same place?' },
        {
          t: 'chips',
          options: [
            { label: 'Yes, by the door', go: 'territory-check' },
            /*
             * "All over" went to the sofa map, so a visitor who had just
             * said the damage is everywhere was asked to point at the
             * worst of it. They have already answered that question.
             * Straight to severity instead.
             */
            { label: 'All over', go: 'options' },
            // Not checked, though, is exactly who the map helps.
            { label: 'I have not checked', go: 'options', safe: true },
          ],
        },
      ],
      accept: [
        { on: 'chip', value: 'Yes, by the door', go: 'territory-check' },
        { on: 'chip', value: 'All over', go: 'options' },
        { on: 'chip', value: 'I have not checked', go: 'options' },
      ],
    },

    /*
     * The uncertainty branch, and it goes somewhere USEFUL rather than
     * apologising. No pattern is itself a finding: it is the one answer
     * that moves a vet up the list, because behaviour without a trigger
     * is more often physical than behavioural.
     */
    'no-pattern': {
      id: 'no-pattern',
      constrained: true,
      effect: { strip: { out: ['territory'], lead: 'medical' } },
      say: [
        {
          t: 'say',
          text: 'No pattern is a pattern. Behaviour with no trigger is more often a body than a mood.',
        },
        { t: 'say', text: 'Litter box habits still normal?' },
        {
          t: 'chips',
          options: [
            { label: 'Yes, all normal', go: 'plan' },
            { label: 'No, that has changed too', go: 'vet-soon' },
            { label: 'I share a box between two cats', go: 'vet-soon', safe: true },
          ],
        },
      ],
      accept: [
        { on: 'chip', value: 'Yes, all normal', go: 'plan' },
        { on: 'chip', value: 'No, that has changed too', go: 'vet-soon' },
        { on: 'chip', value: 'I share a box between two cats', go: 'vet-soon' },
      ],
    },

    'territory-check': {
      id: 'territory-check',
      constrained: true,
      effect: { strip: { win: 'territory', out: ['medical', 'litter'] } },
      say: [
        {
          t: 'say',
          /*
           * Two findings arrive here and the line answered one of them.
           *
           * It read "You rearranged his map and did not file the
           * paperwork" — perfect for the moved cat tree, nonsense for
           * the visitor who said the damage is by the door because they
           * leave the house. Nobody rearranged anything on that path.
           *
           * The shared-node lint did not catch it: neither inbound chip
           * label appears in the sentence, so the match it looks for was
           * never there. This one is semantic, and the only thing that
           * finds it is reading the joins in order. Worth recording as
           * the limit of the automated rule.
           *
           * The replacement names the FINDING, which is what both routes
           * actually established, and the disclosure underneath carries
           * the reasoning.
           */
          text: 'Territory, then. Not boredom, and not a body.',
        },
        {
          t: 'disclose',
          summary: 'Why this and not the others',
          rows: [
            ['Medical', 'no other signs'],
            ['Litter box', 'unchanged'],
            ['Under-stimulated', 'possible, but the timing is too exact'],
          ],
        },
        { t: 'chips', options: [{ label: 'So what do I do?', go: 'options' }] },
      ],
      accept: [{ on: 'chip', value: 'So what do I do?', go: 'options' }],
    },

    plan: {
      id: 'plan',
      constrained: true,
      say: [
        { t: 'say', text: 'Three things, in order of how much you will resent them.' },
        {
          t: 'results',
          items: [
            { name: 'Feed him last thing', detail: 'hunt, eat, groom, sleep — in that order', meta: 'free' },
            { name: 'Ten minutes of wand play', detail: 'before the meal, not after', meta: 'nightly' },
            { name: 'A scratching post by the door', detail: 'vertical, sisal, taller than he is', meta: '~$40' },
          ],
        },
        {
          t: 'chips',
          options: [
            { label: 'That is enough for now', go: 'done' },
            { label: 'I would rather a vet looked at him', go: 'vet-soon' },
          ],
        },
      ],
      accept: [
        { on: 'chip', value: 'That is enough for now', go: 'done' },
        { on: 'chip', value: 'I would rather a vet looked at him', go: 'vet-soon' },
      ],
    },

    /*
     * The grid again, in a different world and with no changes to it.
     * A component that only works in the scenario it was written for is
     * a screen with a costume on; this is the cheapest possible proof
     * that it is not.
     */
    'vet-soon': {
      id: 'vet-soon',
      constrained: true,
      effect: { strip: { win: 'medical' } },
      say: [
        { t: 'say', text: 'Sensible. Nothing here is urgent, so pick a time that suits you.' },
        {
          t: 'timegrid',
          title: 'Pick a time',
          go: 'booked',
          days: [
            {
              label: 'Tomorrow',
              note: 'Sun',
              times: [
                { label: '9:00am', at: '09:00' },
                { label: '11:30am', at: '11:30', gone: true },
                { label: '2:00pm', at: '14:00' },
              ],
            },
            {
              label: 'Monday',
              note: 'Mon',
              times: [
                { label: '8:40am', at: '08:40' },
                { label: '12:15pm', at: '12:15' },
                { label: '5:30pm', at: '17:30', gone: true },
              ],
            },
          ],
        },
      ],
      accept: [{ on: 'chip', value: '*', go: 'booked' }],
    },

    booked: {
      id: 'booked',
      effect: { strip: { win: 'medical' } },
      say: [
        { t: 'say', text: 'Booked. It is on the card below.' },
        {
          t: 'appointment',
          title: 'Vet — behaviour check',
          day: '@picked',
          time: '@picked',
          minutes: 30,
          location: 'Grand Street Veterinary',
          prep: [
            /*
             * Was "a video of the 4am routine", which only the long
             * paste mentions — the read-back bug again, one scenario
             * later. Every route to this card must be able to hear it.
             */
            ['A video of the behaviour', 'they will ask, and you will not be able to describe it'],
            ['His current food', 'a photo of the label is enough'],
          ],
        },
      ],
      auto: 'done',
    },

    /*
     * Tempo 1, identical component, different world.
     *
     * Linear string is a genuine feline emergency — it saws through the
     * gut rather than passing — and the screen must behave exactly as the
     * cardiac one does: halt, one action, no skin, no jokes. Humour at
     * 0.8 does not reach this node, which is the point of safety being
     * unskinnable.
     */
    'vet-now': {
      id: 'vet-now',
      effect: { strip: { withdraw: true } },
      say: [
        {
          t: 'safety',
          tempo: 1,
          headline: 'Call an emergency vet now.',
          body: 'Swallowed string does not pass — it saws. This needs a vet tonight, not an appointment.',
          action: { label: 'Find the nearest emergency vet', kind: 'route', value: '/vets' },
          footnote: 'Do not pull anything you can see. Not from either end.',
        },
      ],
      terminal: true,
    },

    done: {
      id: 'done',
      say: [{ t: 'say', text: 'Still here, if he starts something new.' }],
      terminal: true,
    },
  },
};
