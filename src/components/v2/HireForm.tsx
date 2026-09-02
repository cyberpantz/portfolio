import { useState } from 'react';

/**
 * The /hire enquiry form.
 *
 * Deliberately a SEPARATE Netlify form from the homepage's `contact` — not
 * the same component with different labels. Two reasons:
 *
 *  · Netlify buckets submissions by form name, so project enquiries land in
 *    their own list with their own notification rule, instead of being
 *    mixed in with "just saying hello".
 *  · The questions are different. Someone scoping a project already knows
 *    what they want; asking for shape, timeline and budget up front is the
 *    difference between a reply and a scheduling thread.
 *
 * One-time Netlify setup after deploying: Forms → hire → Add notification.
 *
 * Everything else matches ContactForm on purpose — a real <form> with an
 * action so it still submits without JS, a honeypot rather than a captcha,
 * blur-then-live validation, and a success state that does not navigate.
 */

const SHAPE = [
  'A project, start to finish',
  'Contract or fractional',
  'A full-time role',
  'A partnership or collaboration',
  'Not sure yet — let’s talk',
] as const;

const WHEN = ['Now', 'Within a month', 'This quarter', 'Exploring for later'] as const;

// Asking is not rude; guessing wastes both people's time. "Rather not say"
// sits first-class in the list so nobody feels interrogated by a required
// field they cannot answer yet.
const BUDGET = [
  'Rather not say yet',
  'Under $10k',
  '$10k – $30k',
  '$30k – $75k',
  '$75k+',
  'Salaried role',
] as const;

type FieldName = 'name' | 'email' | 'brief';

const RULES: Record<FieldName, (v: string) => string> = {
  name: (v) => (v.trim() ? '' : 'Please enter your name.'),
  email: (v) => {
    if (!v.trim()) return 'Please enter your email address.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
      ? ''
      : 'That does not look like an email address.';
  },
  brief: (v) => {
    if (!v.trim()) return 'Please say a little about the work.';
    return v.trim().length < 20 ? 'A couple more sentences would help me answer usefully.' : '';
  },
};

const LABEL = 'block text-meta font-medium tracking-[0.16em] uppercase text-muted';
const HINT = 'mt-1.5 block text-meta text-muted';
const ERR = 'mt-1.5 block text-meta text-danger';

type Status = { text: string; kind: 'idle' | 'busy' | 'ok' | 'error' };

export default function HireForm() {
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [status, setStatus] = useState<Status>({ text: '', kind: 'idle' });
  const busy = status.kind === 'busy';

  const validate = (field: FieldName, value: string) => {
    const msg = RULES[field](value);
    setErrors((prev) => ({ ...prev, [field]: msg }));
    return msg;
  };

  const onBlur =
    (field: FieldName) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      validate(field, e.target.value);

  // React 19 split FormEvent into the events the DOM actually fires;
  // onInput is InputEventHandler now.
  const onInput =
    (field: FieldName) => (e: React.InputEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (errors[field]) validate(field, e.currentTarget.value);
    };

  const describedBy = (field: FieldName, extra?: string) =>
    [extra, errors[field] ? `hf-${field}-err` : null].filter(Boolean).join(' ') || undefined;

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const data = new FormData(form);

    const next: Partial<Record<FieldName, string>> = {};
    let firstBad: FieldName | null = null;
    (Object.keys(RULES) as FieldName[]).forEach((f) => {
      const msg = RULES[f](String(data.get(f) ?? ''));
      next[f] = msg;
      if (msg && !firstBad) firstBad = f;
    });
    setErrors(next);

    e.preventDefault();

    if (firstBad) {
      setStatus({ text: 'Please fix the fields marked above.', kind: 'error' });
      document.getElementById(`hf-${firstBad}`)?.focus();
      return;
    }

    setStatus({ text: 'Sending…', kind: 'busy' });

    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data as unknown as Record<string, string>).toString(),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      setStatus({
        text: 'Thanks — that reached me. I read these properly and will reply within a day.',
        kind: 'ok',
      });
    } catch {
      setStatus({
        text: 'That did not send. Please try again, or reach me on LinkedIn.',
        kind: 'error',
      });
    }
  };

  return (
    <form
      name="hire"
      method="POST"
      action="/thanks"
      data-netlify="true"
      netlify-honeypot="company-url"
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="form-name" value="hire" />

      {/* Off-screen rather than display:none — some screen readers skip
          those, and Netlify wants a real field. */}
      <p className="absolute -left-[9999px] top-0" aria-hidden="true">
        <label>
          Leave this field empty
          <input name="company-url" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
        <div>
          <label className={LABEL} htmlFor="hf-name">
            Your name
          </label>
          <input
            className="field mt-2.5"
            id="hf-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy('name')}
            onBlur={onBlur('name')}
            onInput={onInput('name')}
          />
          {errors.name && (
            <span className={ERR} id="hf-name-err">
              {errors.name}
            </span>
          )}
        </div>

        <div>
          <label className={LABEL} htmlFor="hf-email">
            Email
          </label>
          <input
            className="field mt-2.5"
            id="hf-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy('email')}
            onBlur={onBlur('email')}
            onInput={onInput('email')}
          />
          {errors.email && (
            <span className={ERR} id="hf-email-err">
              {errors.email}
            </span>
          )}
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="hf-org">
          Company or project
        </label>
        <input
          className="field mt-2.5"
          id="hf-org"
          name="org"
          type="text"
          autoComplete="organization"
          aria-describedby="hf-org-hint"
        />
        <span className={HINT} id="hf-org-hint">
          Optional. A link is fine too.
        </span>
      </div>

      <div className="grid grid-cols-3 gap-6 max-md:grid-cols-1">
        <div>
          <label className={LABEL} htmlFor="hf-shape">
            What shape
          </label>
          <select className="field mt-2.5" id="hf-shape" name="shape" defaultValue={SHAPE[0]}>
            {SHAPE.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="hf-when">
            Starting when
          </label>
          <select className="field mt-2.5" id="hf-when" name="timeline" defaultValue={WHEN[1]}>
            {WHEN.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="hf-budget">
            Budget
          </label>
          <select className="field mt-2.5" id="hf-budget" name="budget" defaultValue={BUDGET[0]}>
            {BUDGET.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="hf-brief">
          What are you building
        </label>
        <textarea
          className="field mt-2.5"
          id="hf-brief"
          name="brief"
          rows={7}
          required
          aria-invalid={errors.brief ? true : undefined}
          aria-describedby={describedBy('brief', 'hf-brief-hint')}
          onBlur={onBlur('brief')}
          onInput={onInput('brief')}
        />
        <span className={HINT} id="hf-brief-hint">
          The problem, who it is for, and what is currently in the way. Rough is fine.
        </span>
        {errors.brief && (
          <span className={ERR} id="hf-brief-err">
            {errors.brief}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <button
          type="submit"
          disabled={busy}
          className="btn-roll inline-flex min-h-11 cursor-pointer items-center gap-3 bg-ink px-8 py-4
                     text-meta font-medium tracking-[0.18em] uppercase text-paper transition-colors
                     duration-500 ease-editorial hover:bg-accent hover:text-on-accent
                     disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="btn-roll-window">
            <span className="btn-roll-deck">
              <span className="btn-roll-face">{busy ? 'Sending' : 'Send the brief'}</span>
              {/* Duplicated for the roll, hidden so the accessible name
                  stays a single phrase. */}
              <span className="btn-roll-face" aria-hidden="true">
                {busy ? 'Sending' : 'Send the brief'}
              </span>
            </span>
          </span>
          <span aria-hidden="true" className="btn-roll-glyph">
            →
          </span>
        </button>

        <p
          role="status"
          aria-live="polite"
          className={`text-caption ${status.kind === 'error' ? 'text-danger' : 'text-ink-2'}`}
        >
          {status.text}
        </p>
      </div>
    </form>
  );
}
