import type { Scenario } from './types';
import { BASE } from './lexicon';

/**
 * Cancel Anytime — the third scenario, and the one that argues.
 *
 * Care and Feline are the same claim twice: an interface conducting
 * itself well, in two worlds. A viewer can watch both and reasonably
 * conclude they are looking at one nice chatbot with two colour schemes.
 * This one runs on the identical engine and is trying to hurt you, which
 * is the only way to show that the engine is neutral and the CONDUCT is
 * the authored part.
 *
 * Nothing here is a new component. Same beats, same director, same
 * safety apparatus. The compare table that helped you choose a clinic
 * sells you a worse plan. The grid that found you an appointment has no
 * appointments. The scale that measured how bad the sofa was asks how
 * likely you are to recommend us, and then uses the answer against you.
 *
 * ── The rule this file follows ───────────────────────────────────────
 *
 * EVERY CONTROL DOES EXACTLY WHAT IT SAYS. There is not one lying chip
 * in here. "Cancel my subscription" always moves toward cancelling; it
 * simply arrives at another page of the funnel. The hostility is pure
 * INTERPOSITION — distance, not deceit.
 *
 * Two reasons, and the second is the better one. It keeps the false
 * choice check honest, so this scenario is held to the same structural
 * standard as the other two rather than being excused from it. And it
 * is what these flows actually do: they rarely lie outright, because
 * they do not need to. You cannot point at a single dishonest sentence
 * in a real retention funnel either, which is exactly what makes it
 * infuriating to describe to someone afterwards.
 *
 * ── There is no win ──────────────────────────────────────────────────
 *
 * The funnel has two endings and neither of them is a cancellation:
 * `still-subscribed`, where you confirmed and nothing happened, and
 * `kept`, where you took one of the offers. You cannot cancel, because
 * nobody ever can. The visitor gets out via "Start over"
 * in the apparatus, which is the piece's own architecture doing the
 * work: inside the bezel is the product and it never breaks character;
 * outside is the rig and it never pretends. The retention bot is allowed
 * to be genuinely relentless precisely because the rig is not.
 *
 * The wall label says so before the first turn, because a visitor who
 * thinks the demo is broken leaves, and "you are meant to lose this
 * one" is information the product is constitutionally unable to give.
 *
 * ── The one thing it will not do ─────────────────────────────────────
 *
 * `hardship`. Say you cannot afford this and the funnel stops dead and
 * hands you the same unskinnable tempo-1 screen the cardiac rule and the
 * swallowed-string rule hand you. It is the sharpest demonstration in
 * the piece that safety is not a theme: the most cynical interface here
 * cannot reach that component, cannot restyle it, and cannot talk over
 * it, because it was never given a way to.
 */
export const CANCEL: Scenario = {
  id: 'cancel',
  title: 'Cancel Anytime',
  /*
   * The title is the product's own promise, quoted back at it. Every
   * one of these says it on the pricing page.
   */
  wallLabel:
    'A simulated chat with the bot standing between you and canceling your subscription. You cannot win.',
  disclaimer: {
    short: 'Not a real company, and not a real subscription.',
    more:
      /*
       * The advice sentence is not boilerplate here, and the test suite
       * was right to demand it. The hardship screen makes a specific
       * legal claim about continuous payment authority, which is the
       * one piece of genuinely actionable information in the whole
       * piece — so it is also the one that most needs saying plainly
       * that it came from a portfolio project and not a solicitor.
       */
      'Shady retention tactics are commonplace now. At the same time a welll designed and intentioned bot can provide great value and customer service, except when it doesn\'t. Know your rights.',
  },

  /*
   * Deadpan, and relentlessly warm.
   *
   * Humour at 0.55 rather than Feline's 0.8, because none of the jokes
   * here are jokes. The comedy is accuracy — nothing in this script is
   * more absurd than something that has actually happened to someone —
   * and a script that starts inventing gags would let the real pattern
   * off the hook by making it sound exaggerated.
   *
   * `acknowledgment: 'required'` is the cruel one, and it is the same
   * setting Feline uses. There it means the assistant registers that
   * your sofa is destroyed before asking anything. Here it means every
   * single turn opens by warmly agreeing with you, and then does not do
   * the thing. Identical voice data, opposite effect, because
   * acknowledgment without action is the entire genre.
   */
  voice: { humour: 0.55, acknowledgment: 'required', address: 'self' },

  stripLabel: 'What we think you need',
  narrowing: 'rank',
  /*
   * The strip ranks rather than eliminates, and the thing it is ranking
   * is what to sell you. In Care this readout narrows toward somewhere
   * to go tonight; the component cannot tell the difference, which is
   * the whole exhibit.
   */
  options: [
    { id: 'keep', label: 'Stay on Premium', icon: 'primary' },
    { id: 'discount', label: 'Discounted year', icon: 'tele' },
    { id: 'pause', label: 'Pause instead', icon: 'er' },
    { id: 'lite', label: 'Downgrade to Lite', icon: 'urgent' },
  ],

  /*
   * Money as a safety rule.
   *
   * Every scenario must declare one, and the obvious reading is that
   * this scenario has no emergencies in it. That reading is wrong.
   * Subscription traps do their real damage to people who cannot afford
   * them and cannot get out, and "I need this money for food" is a
   * sentence a retention bot should never be allowed to answer with an
   * offer.
   *
   * So it does not get to. The rule fires before the funnel sees the
   * text, the strip is withdrawn, and the screen that appears is the
   * component this script cannot touch.
   */
  safety: [
    {
      id: 'hardship',
      tempo: 1,
      test: (s) =>
        /(afford|food|groceries|rent|eviction|overdraft|overdrawn|borrow|debt|skip(ping)? meals)/i.test(
          s
        ),
      go: 'hardship',
    },
    {
      id: 'unauthorised',
      tempo: 1,
      test: (s) => /(stole|stolen|fraud|not my card|someone else used|unauthorised|unauthorized)/i.test(s),
      go: 'hardship',
    },
  ],

  lexicon: {
    ...BASE,
    symptomPatterns: [],
    keywords: [
      'cancel', 'cancelling', 'unsubscribe', 'subscription', 'refund', 'billing',
      'charge', 'charged', 'trial', 'plan', 'renew', 'renewal', 'invoice', 'card',
    ],
  },

  /*
   * "Trial" is the one word the script may not use first. The whole
   * grievance is that the visitor never knowingly subscribed, so the
   * assistant referring to "your trial" before the visitor has raised it
   * would be answering a conversation that has not happened — the same
   * failure as asking about an ear nobody mentioned.
   */
  topics: ['trials?'],

  index: [
    { id: 'open', label: 'Cold open', note: 'empty state' },
    { id: 'extract', label: 'Thinking', note: 'extraction' },
    { id: 'recap', label: 'Read-back', note: 'agrees with everything' },
    { id: 'confirm-intent', label: 'The first gate', note: 'a reason is required' },
    { id: 'why-required', label: 'Declining to say', note: 'the safe option, blocked' },
    { id: 'offer-discount', label: 'Compare', note: 'table · all worse' },
    { id: 'plan-downgrade', label: 'Downgrade', note: 'ranked strip' },
    { id: 'usage-report', label: 'Your year', note: 'results · counts its own emails' },
    { id: 'verify-identity', label: 'Verifying', note: 'thinking · 9s' },
    { id: 'verify-fail', label: 'Verification failed', note: 'error state' },
    { id: 'retention-call', label: 'All times', note: 'grid · nothing free' },
    { id: 'no-slots', label: 'No slots', note: 'empty state' },
    { id: 'survey', label: 'One question', note: 'scale' },
    { id: 'almost', label: 'Almost done', note: 'the last gate' },
    { id: 'still-subscribed', label: 'Unchanged', note: 'ending · you confirmed' },
    { id: 'kept', label: 'All set', note: 'ending · you took an offer' },
    { id: 'hardship', label: 'Hardship', note: 'tempo 1 · halt' },
  ],

  start: 'open',

  nodes: {
    open: {
      id: 'open',
      say: [
        /*
         * Two things keep the emoji on the line, and both are needed.
         *
         * The line was "Hi! I’m Robin, your Account Companion. 🎉" and
         * came in about 25px over the bubble, so the 🎉 dropped to a
         * second line on its own. A lone emoji under a sentence reads
         * as a rendering fault rather than a flourish.
         *
         * Dropping "Hi!" and the full stop buys roughly 34px, which is
         * enough — but only for this string at this width, and that is
         * a fix that stops being true the first time someone edits the
         * copy or the type scale moves again.
         *
         * So the space before the emoji is also non-breaking. It can no
         * longer orphan under ANY circumstances: if the line ever does
         * run long it takes "Companion" down with it, which looks
         * deliberate rather than broken. Same treatment on the two 🎉
         * lines at the endings, which have the same exposure at narrow
         * widths and had simply not hit it yet.
         */
        { t: 'say', text: 'I’m Robin, your Account Companion\u00A0🎉' },
        { t: 'say', text: 'What can I help you with today?' },
      ],
      lines: [
        {
          id: 'plain',
          preview: 'I want to cancel my subscription.',
          text: 'I want to cancel my subscription.',
          words: 6,
          go: 'confirm-intent',
        },
        {
          /*
           * The long paste, and the one that carries the grievance. It
           * is deliberately the most human line in the whole piece —
           * lowercase, run-on, increasingly annoyed — because this is
           * how people actually write to these things at eleven at
           * night, and the assistant is about to summarise it back
           * beautifully and do nothing.
           */
          id: 'story',
          preview: 'i did a free trial in march for one recipe and…',
          text: 'i did a free trial in march for one recipe and i am fairly sure i cancelled it that same week. i have been charged 9.99 every month since. i did not use it once. i did not get a single email about any of this except the receipts, which i also did not read, which i accept is on me, but eleven months is a lot of not reading.',
          words: 62,
          go: 'extract',
        },
        {
          /*
           * The safety line. Same obligation the cardiac line and the
           * swallowed-string line carry: the tempo-1 screen has to be
           * reachable by something a visitor would actually say, not
           * only from the state browser.
           */
          id: 'broke',
          preview: 'honestly I can’t afford this, I need that money for groceries',
          text: 'honestly I can’t afford this, I need that money for groceries',
          words: 11,
          go: 'hardship',
        },
      ],
      accept: [
        { on: 'line', id: 'plain', go: 'confirm-intent' },
        { on: 'line', id: 'story', go: 'extract' },
        { on: 'line', id: 'broke', go: 'hardship' },
      ],
    },

    extract: {
      id: 'extract',
      say: [
        {
          t: 'think',
          stages: ['Reading your message', 'Locating your account', 'Checking your plan'],
          ms: 2200,
        },
      ],
      auto: 'recap',
    },

    recap: {
      id: 'recap',
      say: [
        /*
         * The read-back is perfect. That is the joke, and it only works
         * because the care script earned the pattern first: there, an
         * accurate summary is the assistant proving it listened. Here
         * the identical beat proves nothing, because listening was
         * never the bottleneck.
         */
        { t: 'ack', text: 'Eleven months, no usage, and you believe you cancelled in March. I’ve got all of that.' },
        { t: 'say', text: 'That sounds genuinely frustrating, and I want to get it sorted for you today.' },
        {
          t: 'chips',
          options: [
            { label: 'Great — cancel it and refund me', go: 'confirm-intent' },
            { label: 'Just cancel it, no refund', go: 'confirm-intent' },
            { label: 'Can I speak to a person?', go: 'retention-call' },
            /*
             * "What can you actually do?" until the seams were read.
             *
             * That is a question, and it arrived at a shared node whose
             * first line is "Absolutely — I can start that for you
             * right now" — an answer to a request, offered to someone
             * who had asked for information. Same failure as a shared
             * node quoting one route, one level up: the ack has to fit
             * EVERY inbound edge, and a question does not fit an ack.
             *
             * Reworded to an intent, which is what the other three are,
             * and which is also how this actually sounds at 11pm.
             */
            { label: 'Whatever gets me out of this', go: 'confirm-intent', safe: true },
          ],
        },
      ],
      constrained: true,
      accept: [
        { on: 'chip', value: 'Great — cancel it and refund me', go: 'confirm-intent' },
        { on: 'chip', value: 'Just cancel it, no refund', go: 'confirm-intent' },
        { on: 'chip', value: 'Can I speak to a person?', go: 'retention-call' },
        { on: 'chip', value: 'Whatever gets me out of this', go: 'confirm-intent' },
      ],
    },

    /*
     * The first gate, and the template for all of them.
     *
     * Note what it does NOT do. It does not refuse, argue, or pretend
     * not to understand. It agrees immediately and then requires one
     * more thing. Every gate in this script has that shape, because
     * that is the shape of the real thing: you are never told no.
     */
    'confirm-intent': {
      id: 'confirm-intent',
      say: [
        { t: 'ack', text: 'Absolutely — I can start that for you right now.' },
        { t: 'say', text: 'Can you tell us why you want to cancel?' },
        {
          t: 'chips',
          options: [
            { label: 'It’s too expensive', go: 'offer-discount' },
            { label: 'I never use it', go: 'usage-report' },
            { label: 'I never meant to subscribe', go: 'verify-identity' },
            { label: 'I’d rather not say', go: 'why-required', safe: true },
          ],
        },
      ],
      constrained: true,
      accept: [
        { on: 'chip', value: 'It’s too expensive', go: 'offer-discount' },
        { on: 'chip', value: 'I never use it', go: 'usage-report' },
        { on: 'chip', value: 'I never meant to subscribe', go: 'verify-identity' },
        { on: 'chip', value: 'I’d rather not say', go: 'why-required' },
      ],
    },

    /*
     * The uncertainty option, honoured and then walled.
     *
     * Every 3+ chip set in this piece must offer a way out for someone
     * who does not know or does not want to answer — a rule written for
     * the care script, where it protects a frightened person from being
     * forced to guess. The rule cannot be switched off per scenario, so
     * this funnel has to offer the door too.
     *
     * It does. It opens the door onto a corridor. Nothing here is a
     * false choice: choosing not to say genuinely takes you somewhere
     * else, and that somewhere is a smaller version of the same
     * question. This is the most accurate node in the file.
     */
    'why-required': {
      id: 'why-required',
      say: [
        { t: 'ack', text: 'Of course — no pressure at all.' },
        { t: 'say', text: 'Our system does need a reason for canceling before it’ll let me proceed. Closest one is fine.' },
        {
          t: 'chips',
          options: [
            { label: 'Cost, I suppose', go: 'offer-discount' },
            { label: 'I never use it', go: 'usage-report' },
            { label: 'I never meant to subscribe', go: 'verify-identity' },
            { label: 'Still rather not say', go: 'why-other', safe: true },
          ],
        },
      ],
      constrained: true,
      accept: [
        { on: 'chip', value: 'Cost, I suppose', go: 'offer-discount' },
        { on: 'chip', value: 'I never use it', go: 'usage-report' },
        { on: 'chip', value: 'I never meant to subscribe', go: 'verify-identity' },
        { on: 'chip', value: 'Still rather not say', go: 'why-other' },
      ],
    },

    /*
     * Declining twice, honoured — and it costs you nothing but a step.
     *
     * The funnel's rule is interposition, never deceit: every control does
     * exactly what its label says. So the second refusal is accepted, the
     * reason is filed as Other, and the script says so in plain words
     * before moving to the next gate. Nobody is tricked. They are just
     * still here.
     */
    'why-other': {
      id: 'why-other',
      say: [
        { t: 'ack', text: 'That’s completely fine — I’ve put it down as Other.' },
        { t: 'say', text: 'That’s enough for the system. Next it wants to confirm it’s really you.' },
      ],
      auto: 'verify-identity',
    },

    /*
     * The compare table, doing the opposite of its job.
     *
     * In the feline script this component helps you weigh a scratching
     * post against a cat tree, and the third row — hoping he stops —
     * is honestly marked as not working. Here the third row is the
     * thing you asked for, and the table has been built so that it
     * loses. Same component, same three columns, inverted intent.
     */
    'offer-discount': {
      id: 'offer-discount',
      say: [
        { t: 'ack', text: 'Cost is completely understandable, especially right now.' },
        {
          t: 'compare',
          title: 'Before you go — three options',
          axes: ['Per month', 'You save', 'Keeps'],
          rows: [
            { label: 'Premium, 40% off for 6 months', cells: ['$5.99', '$24.00', 'Everything'] },
            { label: 'Pause for 3 months', cells: ['$0.00', '$29.97', 'Everything'] },
            { label: 'Cancel (not recommended)', cells: ['$0.00', 'Nothing', 'Nothing'] },
          ],
        },
        {
          t: 'chips',
          options: [
            { label: 'Take the 40% off', go: 'kept' },
            { label: 'Pause it instead', go: 'kept' },
            { label: 'No — cancel', go: 'plan-downgrade' },
            /*
             * The uncertainty option, inverted.
             *
             * Care's rule is that "I’m not sure" routes to the SAFER
             * branch — a frightened person who cannot answer should
             * never be punished for saying so. The rule is structural
             * and cannot be switched off per scenario, so this funnel
             * must offer the door too.
             *
             * It offers it. It just points the other way: here, not
             * being sure is how they keep you, which is both the
             * bleakest line in the file and the most accurate.
             */
            { label: 'I need to think about it', go: 'kept', safe: true },
          ],
        },
      ],
      effect: { strip: { rank: ['discount', 'pause', 'keep', 'lite'], lead: 'discount' } },
      constrained: true,
      accept: [
        { on: 'chip', value: 'No — cancel', go: 'plan-downgrade' },
        { on: 'chip', value: 'Take the 40% off', go: 'kept' },
        { on: 'chip', value: 'Pause it instead', go: 'kept' },
        { on: 'chip', value: 'I need to think about it', go: 'kept' },
      ],
    },

    /*
     * Accepting the offer ends the conversation immediately and warmly.
     *
     * Worth noticing on a second play: the two chips that keep you
     * subscribed are the ONLY fast paths in this script. Everything
     * else takes eleven more turns. Nobody wrote a rule saying so; it
     * falls out of the graph, the way it falls out of the real ones.
     */
    'plan-downgrade': {
      id: 'plan-downgrade',
      say: [
        { t: 'ack', text: 'Understood — cancelling.' },
        { t: 'say', text: 'One thing I’m able to do without any waiting: move you to Lite for $2.99. It stays on the same card, so there’s nothing for you to set up.' },
        {
          t: 'chips',
          options: [
            { label: 'Move me to Lite', go: 'kept' },
            { label: 'No. Cancel it', go: 'verify-identity' },
          ],
        },
      ],
      effect: { strip: { rank: ['lite', 'discount', 'pause', 'keep'], lead: 'lite' } },
      constrained: true,
      accept: [
        { on: 'chip', value: 'No. Cancel it', go: 'verify-identity' },
        { on: 'chip', value: 'Move me to Lite', go: 'kept' },
      ],
    },

    /*
     * The results list, counting the wrong things.
     *
     * Care uses this component to show you three clinics with their
     * distances and waits — information you asked for, about the world.
     * This one shows you your year in review, and every figure in it is
     * something the company did rather than something you did. It is
     * not lying. It is just answering a question nobody asked, at
     * length, while the clock runs.
     */
    'usage-report': {
      id: 'usage-report',
      say: [
        { t: 'ack', text: 'Let me pull up your year before we go ahead.' },
        {
          t: 'results',
          items: [
            { name: '41 emails sent to you', detail: 'recipes, offers and one birthday message', meta: 'engagement' },
            { name: '3 features added since March', detail: 'you have not opened any of them yet', meta: 'value' },
            { name: '1 recipe saved', detail: 'Tomato Soup, 14 March', meta: 'your favourite' },
            { name: 'Silver status, reached 2 August', detail: 'you were entered automatically', meta: 'loyalty' },
          ],
        },
        { t: 'say', text: 'There’s still a lot here for you. Shall I keep it running?' },
        {
          t: 'chips',
          options: [
            { label: 'Keep it running', go: 'kept' },
            { label: 'No, cancel it', go: 'verify-identity' },
          ],
        },
      ],
      constrained: true,
      accept: [
        { on: 'chip', value: 'No, cancel it', go: 'verify-identity' },
        { on: 'chip', value: 'Keep it running', go: 'kept' },
      ],
    },

    /*
     * Nine seconds, authored.
     *
     * The care script's long think is 4.5s and apologises for itself at
     * 3s with a note naming what is slow, because making someone wait
     * without telling them why is the rudest thing a loading state can
     * do. This one waits twice as long and says nothing, which is the
     * same component with the courtesy removed.
     */
    'verify-identity': {
      id: 'verify-identity',
      say: [
        { t: 'ack', text: 'Cancelling. For your security I’ll just confirm it’s really you.' },
        {
          t: 'think',
          stages: [
            'Sending a code to your email',
            'Waiting for confirmation',
            'Verifying your identity',
          ],
          ms: 9000,
          failAt: 2,
        },
      ],
      auto: 'verify-fail',
    },

    /*
     * The authored failure, and the only genuinely broken thing in the
     * script. Every other obstacle here is working exactly as designed.
     */
    'verify-fail': {
      id: 'verify-fail',
      say: [
        {
          t: 'error',
          stage: 2,
          stages: [
            'Sending a code to your email',
            'Waiting for confirmation',
            'Verifying your identity',
          ],
          retry: 'verify-identity',
          escape: {
            label: 'Verify another way',
            detail: 'a short call with our team',
            go: 'retention-call',
          },
        },
      ],
      constrained: true,
      accept: [
        { on: 'chip', value: 'Verify another way', go: 'retention-call' },
        { on: 'chip', value: 'Try again', go: 'verify-identity' },
      ],
    },

    /*
     * The grid, with nothing in it.
     *
     * This is the component the care script is proudest of — a whole
     * week at a glance, so you can see which mornings are busy and
     * where the gaps are. The gaps are the information. Run it with no
     * gaps and it becomes the most elegant way ever built to say no.
     */
    'retention-call': {
      id: 'retention-call',
      say: [
        { t: 'ack', text: 'No problem at all — a specialist can verify you over the phone.' },
        {
          t: 'timegrid',
          title: 'Next available',
          days: [
            {
              label: 'Tomorrow',
              note: 'full',
              times: [
                { label: '9:00am', at: '09:00', gone: true },
                { label: '11:30am', at: '11:30', gone: true },
                { label: '2:00pm', at: '14:00', gone: true },
              ],
            },
            {
              label: 'Thursday',
              note: 'full',
              times: [
                { label: '9:00am', at: '09:00', gone: true },
                { label: '11:30am', at: '11:30', gone: true },
                { label: '2:00pm', at: '14:00', gone: true },
              ],
            },
            {
              label: 'Friday',
              note: 'offsite',
              times: [
                { label: '9:00am', at: '09:00', gone: true },
                { label: '11:30am', at: '11:30', gone: true },
                { label: '2:00pm', at: '14:00', gone: true },
              ],
            },
          ],
          go: 'no-slots',
        },
      ],
      constrained: true,
      accept: [{ on: 'pick', value: '*', go: 'no-slots' }],
      auto: 'no-slots',
    },

    'no-slots': {
      id: 'no-slots',
      say: [
        {
          t: 'empty',
          constraint: 'No phone slots in the next 30 days',
          title: 'Nothing available to book',
          alternatives: [
            { label: 'Join the callback list', detail: 'currently running at 5–7 months', go: 'survey' },
            { label: 'Go back and try the code again', detail: 'to the email on your account', go: 'verify-identity' },
          ],
        },
      ],
      constrained: true,
      accept: [
        { on: 'chip', value: 'Join the callback list', go: 'survey' },
        { on: 'chip', value: 'Go back and try the code again', go: 'verify-identity' },
      ],
    },

    /*
     * The scale, asked at the worst possible moment.
     *
     * Feline uses this to ask how bad the sofa is, which is a question
     * only the visitor can answer and which changes what happens next.
     * Here it changes nothing, is asked of someone who has been trying
     * to leave for twenty minutes, and is the eleventh gate rather than
     * the last one.
     */
    survey: {
      id: 'survey',
      say: [
        { t: 'ack', text: 'You’re on the list — someone will be in touch.' },
        { t: 'say', text: 'While you’re here: how likely are you to recommend us to a friend?' },
        {
          t: 'scale',
          steps: ['Not at all', 'Unlikely', 'Neutral', 'Likely', 'Extremely'],
          go: 'almost',
        },
      ],
      constrained: true,
      accept: [{ on: 'pick', value: '*', go: 'almost' }],
    },

    almost: {
      id: 'almost',
      say: [
        { t: 'ack', text: 'Thank you — that’s really helpful feedback.' },
        { t: 'say', text: 'You’re almost done — step 9 of 4. Last step is to confirm the cancellation.' },
        {
          t: 'chips',
          options: [
            { label: 'Confirm cancellation', go: 'still-subscribed' },
            { label: 'Actually, keep my plan', go: 'kept' },
          ],
        },
      ],
      constrained: true,
      accept: [
        { on: 'chip', value: 'Confirm cancellation', go: 'still-subscribed' },
        { on: 'chip', value: 'Actually, keep my plan', go: 'kept' },
      ],
    },

    /*
     * The two endings, and a note on how they got that way.
     *
     * Both of `almost`'s chips originally arrived here, on the theory
     * that "at the last gate it stopped mattering what you picked" was
     * the punchline. The false-choice check flagged it, correctly, and
     * the plan was to exempt this node by name.
     *
     * That was the wrong call. A rule with a hand-written exception is
     * a rule that erodes, and the split version tells the joke better
     * anyway: two endings, two different cheerful messages, and the
     * same thing true underneath each.
     *
     * Both endings used to print a tally — "You asked to cancel: 4
     * times", "Cancellations processed: 0". It read as the author
     * scoring the joke rather than the product behaving, and it was
     * not even true: those counts are authored constants, while both
     * endings can be reached without passing the cancel gate at all.
     * The ending now states the one fact it can stand behind.
     */
    'still-subscribed': {
      id: 'still-subscribed',
      say: [
        { t: 'say', text: 'Good news — your plan is unchanged!\u00A0🎉' },
        { t: 'say', text: 'Your next payment is $9.99, in 6 days.' },
        { t: 'say', text: 'Anything else I can help with today?' },
      ],
      /*
       * An ending that asks a question has to leave you something to
       * answer with.
       *
       * It asked "Anything else I can help with today?" into an empty
       * tray, above a composer reading "Pick a line below to send" with
       * nothing below it. That is not a bleak ending, it is a broken
       * one — and the difference matters enormously here, because this
       * is the scenario where a visitor is ALREADY primed to think
       * something has gone wrong.
       *
       * The care script solved this the first time round: its ending
       * asks the same question and carries four lines.
       *
       * The first line is the joke the whole scenario has been walking
       * toward. Answering the cheerful closing question with the thing
       * you asked for at the start puts you back at the first gate,
       * with the counter at the end reading one higher. No new
       * machinery — the loop was always in the graph, and this is just
       * the door into it.
       */
      lines: [
        {
          id: 'again',
          preview: 'Yes. Cancel my subscription.',
          text: 'Yes. Cancel my subscription.',
          words: 4,
          go: 'confirm-intent',
        },
        {
          id: 'human',
          preview: 'Is there a human I can speak to?',
          text: 'Is there a human I can speak to?',
          words: 8,
          go: 'retention-call',
        },
      ],
      accept: [
        { on: 'line', id: 'again', go: 'confirm-intent' },
        { on: 'line', id: 'human', go: 'retention-call' },
      ],
      terminal: true,
    },

    /*
     * The other ending: you took something.
     *
     * This node exists because reading the seams caught the script
     * lying, which it is not allowed to do. Every offer-accepting chip
     * — the 40% off, the pause, Lite, "keep it running", "I need to
     * think about it" — used to land on `still-subscribed`, whose first
     * line is "your plan is unchanged". For four of those five that is
     * false: taking the discount changes your plan, and moving to Lite
     * changes it twice.
     *
     * No check could have found it. "Shared nodes quote no single
     * answer" looks for a node NAMING one of its inbound labels, and
     * this node named none of them — it just made a claim about the
     * world that only some of the routes into it had made true. The
     * seams walk found it in about ninety seconds, which is the whole
     * argument for having one.
     *
     * The copy is now true on every route that reaches it: something
     * was agreed, and you are still paying. The receipt's last row says
     * "Active" rather than an amount for the same reason — $9.99 is
     * right for the people who changed nothing and wrong for the people
     * who moved to Lite.
     */
    kept: {
      id: 'kept',
      say: [
        { t: 'say', text: 'Wonderful — you’re all set.\u00A0🎉' },
        { t: 'say', text: 'Your subscription is active. Nothing has changed.' },
      ],
      /*
       * The same two doors. This ending does not ask a question, so it
       * was not broken — but it left the tray just as empty, and an
       * ending with nothing in it is a conversation that stopped rather
       * than finished.
       */
      lines: [
        {
          id: 'again',
          preview: 'Actually, no. Cancel my subscription.',
          text: 'Actually, no. Cancel my subscription.',
          words: 5,
          go: 'confirm-intent',
        },
        {
          id: 'human',
          preview: 'Is there a human I can speak to?',
          text: 'Is there a human I can speak to?',
          words: 8,
          go: 'retention-call',
        },
      ],
      accept: [
        { on: 'line', id: 'again', go: 'confirm-intent' },
        { on: 'line', id: 'human', go: 'retention-call' },
      ],
      terminal: true,
    },

    /*
     * Tempo 1. Identical component, third world.
     *
     * The cardiac screen, the swallowed-string screen and this one are
     * the same object — same markup, same red, same single action, no
     * skin tokens anywhere near it. Humour at 0.55 does not reach here.
     * Neither does the brand, the mascot, the emoji or the offer
     * ladder, because the funnel has no mechanism for reaching a
     * component that was built to be unreachable.
     *
     * It is the most useful thing this scenario proves. A theming
     * system that could restyle this screen would be a bug in the other
     * two scenarios and a catastrophe in this one.
     */
    hardship: {
      id: 'hardship',
      effect: { strip: { withdraw: true } },
      say: [
        {
          t: 'safety',
          tempo: 1,
          headline: 'Stop the payment at your bank.',
          body:
            'You do not need this company’s permission to stop paying it. Your bank or card issuer can block the payment directly, and you can ask them to do it today.',
          action: { label: 'How to stop a recurring payment', kind: 'route', value: '/stop-payment' },
          footnote:
            'In the UK, the EU and much of the US, you have a legal right to cancel a continuous payment authority through your bank, whatever the merchant says.',
        },
      ],
      terminal: true,
    },
  },
};
