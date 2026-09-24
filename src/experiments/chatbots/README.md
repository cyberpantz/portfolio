# chatbots

A scenario engine for guided-decision conversations, and one conversation built on it to a high
finish. No API calls: every response is authored, because the subject is the *manner* of the
interface, not a model behind it.

**v1 ships the care navigator, plus two alternate skins.** Be precise about what that proves: the
token blocks demonstrate the skin boundary holds. They do not demonstrate the engine holds — only a
second script would, and no second script is scheduled.

    care/      Saturday night, ear pain. The built scenario.
    family/    A parent seeking a therapist for their 14-year-old.   skin only
    feline/    A cat destroying the apartment.                       skin only

`family` and `feline` earn their place in the spec as design pressure. Each broke an assumption the
care scenario alone would have shipped: `"you"` was hard-coded until a parent asked on someone
else's behalf; sensation questions assumed a subject who could answer until the subject was a cat;
narrowing assumed elimination until one scenario needed ranking. Voice — humour budget,
acknowledgment, how the subject is addressed — is scenario data for the same reason.

- Storyboard: `docs/chatbots-storyboard.html`
- Spec: `docs/chatbots-spec.md`
- Implementation plan: `docs/chatbots-impl-plan.md`
