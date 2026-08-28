import { assertValidQuiz, type Quiz } from './types';

/**
 * Eight questions. Deliberately silly, deliberately dry — deadpan
 * setup, flat payoff. No exclamation marks, no cheerleading.
 */
export const farmAnimals: Quiz = assertValidQuiz({
  id: 'farm-animals',
  title: 'Farm Animals',
  blurb: 'Eight questions about livestock. Harder than it sounds, which says more about us than about the livestock.',
  questions: [
    {
      id: 'egg',
      kind: 'figure',
      prompt: 'Which of these lays the egg you had for breakfast?',
      aside: 'A genuine question for some of you.',
      choices: [
        { id: 'cow', label: 'Cow', figure: 'cow' },
        { id: 'pig', label: 'Pig', figure: 'pig' },
        { id: 'chicken', label: 'Chicken', figure: 'chicken' },
        { id: 'sheep', label: 'Sheep', figure: 'sheep' },
      ],
      correctId: 'chicken',
      reveal: 'Chicken. The cow was never in the running and you know it.',
    },
    {
      id: 'geese',
      kind: 'text',
      prompt: 'A group of geese on the ground is called a—',
      aside: 'In flight they get a different word. Geese negotiated well.',
      choices: [
        { id: 'gaggle', label: 'Gaggle' },
        { id: 'skein', label: 'Skein' },
        { id: 'clutch', label: 'Clutch' },
        { id: 'murder', label: 'Murder' },
      ],
      correctId: 'gaggle',
      reveal: 'A gaggle on the ground, a skein in the air.',
    },
    {
      id: 'wool',
      kind: 'figure',
      prompt: 'Which one produces wool?',
      choices: [
        { id: 'goat', label: 'Goat', figure: 'goat' },
        { id: 'sheep', label: 'Sheep', figure: 'sheep' },
        { id: 'horse', label: 'Horse', figure: 'horse' },
        { id: 'duck', label: 'Duck', figure: 'duck' },
      ],
      correctId: 'sheep',
      reveal: 'Sheep. Goats produce cashmere, chaos, and an unblinking stare.',
    },
    {
      id: 'stomachs',
      kind: 'text',
      prompt: 'How many stomachs does a cow have?',
      choices: [
        { id: 'four', label: 'Four' },
        { id: 'one-four', label: 'One, with four chambers' },
        { id: 'two', label: 'Two' },
        { id: 'seven', label: 'Seven' },
      ],
      correctId: 'one-four',
      reveal:
        'One stomach, four compartments. Everyone says four. Everyone is wrong, including most farmers.',
    },
    {
      id: 'ruminant',
      kind: 'figure',
      prompt: 'Which of these is a ruminant?',
      aside: 'It means they chew cud. It does not mean they are thoughtful.',
      choices: [
        { id: 'pig', label: 'Pig', figure: 'pig' },
        { id: 'chicken', label: 'Chicken', figure: 'chicken' },
        { id: 'cow', label: 'Cow', figure: 'cow' },
        { id: 'goose', label: 'Goose', figure: 'goose' },
      ],
      correctId: 'cow',
      reveal: 'Cows, sheep and goats all qualify. Pigs do not, and seem fine about it.',
    },
    {
      id: 'capon',
      kind: 'text',
      prompt: 'A castrated male chicken is called a—',
      choices: [
        { id: 'capon', label: 'Capon' },
        { id: 'pullet', label: 'Pullet' },
        { id: 'bantam', label: 'Bantam' },
        { id: 'cockerel', label: 'Cockerel' },
      ],
      correctId: 'capon',
      reveal: 'A capon. Now you know, and there is no giving it back.',
    },
    {
      id: 'pupils',
      kind: 'figure',
      prompt: 'Which animal has rectangular pupils?',
      choices: [
        { id: 'horse', label: 'Horse', figure: 'horse' },
        { id: 'pig', label: 'Pig', figure: 'pig' },
        { id: 'duck', label: 'Duck', figure: 'duck' },
        { id: 'goat', label: 'Goat', figure: 'goat' },
      ],
      correctId: 'goat',
      reveal: 'Goats. Horizontal, rectangular, and pointed at you specifically.',
    },
    {
      id: 'pigs',
      kind: 'text',
      prompt: 'Pigs cannot do which of the following?',
      choices: [
        { id: 'swim', label: 'Swim' },
        { id: 'sky', label: 'Look up at the sky' },
        { id: 'run', label: 'Run faster than a person' },
        { id: 'sounds', label: 'Recognise their own name' },
      ],
      correctId: 'sky',
      reveal:
        'Mostly true — their neck structure makes it hard, though not impossible. Pigs also cannot sweat, which is the more useful fact at a barbecue.',
    },
  ],
  results: [
    {
      min: 8,
      title: 'Certified',
      body: 'Eight for eight. You have either lived on a farm or read about geese for reasons of your own.',
    },
    {
      min: 6,
      title: 'Suspiciously Well Informed',
      body: 'You know more about livestock than your job requires. We did not ask why.',
    },
    {
      min: 4,
      title: 'Competent Townie',
      body: 'You would survive a weekend on a farm. You would not be handed anything sharp.',
    },
    {
      min: 2,
      title: 'Needs Work',
      body: 'You have met an animal before. The details are negotiable.',
    },
    {
      min: 0,
      title: 'Below Coin Toss',
      body: 'Four options, eight questions. The arithmetic here is not flattering.',
    },
  ],
});
