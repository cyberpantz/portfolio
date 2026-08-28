import { useRef, useState } from 'react';

/**
 * Netlify Forms.
 *
 * Netlify parses the built HTML at deploy time and captures POSTs to
 * any form carrying data-netlify. Astro renders this island to static
 * HTML during the build, so the form is present in dist/ for Netlify
 * to find — and because the markup is a real <form> with an action,
 * it still submits if JS never loads. React only adds the inline
 * validation and the no-navigation success state on top.
 *
 * One-time setup after deploying: Netlify → Forms → contact →
 * "Add notification" → Email notification → your address.
 *
 * To swap in a Resend function later, point `action` at the function
 * path and drop the two data-netlify attributes. Nothing else moves.
 */

const ABOUT = [
  'A role',
  'Contract or freelance work',
  'Something you want built',
  'Just saying hello',
] as const;

type FieldName = 'name' | 'email' | 'message';

const RULES: Record<FieldName, (v: string) => string> = {
  name: (v) => (v.trim() ? '' : 'Please enter your name.'),
  email: (v) => {
    if (!v.trim()) return 'Please enter your email address.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
      ? ''
      : 'That does not look like an email address.';
  },
  message: (v) => {
    if (!v.trim()) return 'Please write a message.';
    return v.trim().length < 10 ? 'A little more detail would help.' : '';
  },
};

const LABEL = 'block text-meta font-medium tracking-[0.16em] uppercase text-muted';
const HINT = 'mt-1.5 block text-meta text-muted';
const ERR = 'mt-1.5 block text-meta text-danger';

type Status = { text: string; kind: 'idle' | 'busy' | 'ok' | 'error' };

export default function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [status, setStatus] = useState<Status>({ text: '', kind: 'idle' });
  const busy = status.kind === 'busy';

  const validate = (field: FieldName, value: string) => {
    const msg = RULES[field](value);
    setErrors((prev) => ({ ...prev, [field]: msg }));
    return msg;
  };

  // Validate on blur, then live only once a field has already errored —
  // never while someone is still typing their first attempt.
  const onBlur = (field: FieldName) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    validate(field, e.target.value);

  // React 19 deprecated FormEvent outright — "FormEvent doesn't actually
  // exist" — and split it into the events the DOM really fires. onInput is
  // typed InputEventHandler now, so this takes InputEvent.
  const onInput = (field: FieldName) => (e: React.InputEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (errors[field]) validate(field, e.currentTarget.value);
  };

  const describedBy = (field: FieldName, extra?: string) =>
    [extra, errors[field] ? `cf-${field}-err` : null].filter(Boolean).join(' ') || undefined;

  // Likewise onSubmit is SubmitEventHandler. SubmitEvent also narrows target
  // to HTMLFormElement, which FormEvent never did.
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

    if (firstBad) {
      e.preventDefault();
      setStatus({ text: 'Please fix the fields marked above.', kind: 'error' });
      // namedItem widens to Element | RadioNodeList, neither of which
      // declares focus — query the id instead so this stays typed.
      document.getElementById(`cf-${firstBad}`)?.focus();
      return;
    }

    e.preventDefault();
    setStatus({ text: 'Sending…', kind: 'busy' });

    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data as unknown as Record<string, string>).toString(),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      setStatus({ text: 'Thanks — that reached me. I will reply soon.', kind: 'ok' });
    } catch {
      setStatus({
        text: 'That did not send. Please try again, or reach me on LinkedIn.',
        kind: 'error',
      });
    }
  };

  return (
    <form
      ref={formRef}
      name="contact"
      method="POST"
      action="/thanks"
      data-netlify="true"
      netlify-honeypot="company"
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="form-name" value="contact" />

      {/*
        Honeypot. Not display:none — some screen readers skip those,
        and Netlify wants a real field. Moved off-screen, out of the
        tab order, and labelled so anyone who reaches it knows to skip.
      */}
      <p className="absolute -left-[9999px] top-0" aria-hidden="true">
        <label>
          Leave this field empty
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div>
        <label className={LABEL} htmlFor="cf-name">
          Name
        </label>
        <input
          className="field mt-2.5"
          id="cf-name"
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
          <span className={ERR} id="cf-name-err">
            {errors.name}
          </span>
        )}
      </div>

      <div>
        <label className={LABEL} htmlFor="cf-email">
          Email
        </label>
        <input
          className="field mt-2.5"
          id="cf-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy('email', 'cf-email-hint')}
          onBlur={onBlur('email')}
          onInput={onInput('email')}
        />
        <span className={HINT} id="cf-email-hint">
          So I can write back.
        </span>
        {errors.email && (
          <span className={ERR} id="cf-email-err">
            {errors.email}
          </span>
        )}
      </div>

      <div>
        <label className={LABEL} htmlFor="cf-about">
          What&rsquo;s this about
        </label>
        <select className="field mt-2.5" id="cf-about" name="about" defaultValue={ABOUT[0]}>
          {ABOUT.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL} htmlFor="cf-message">
          Message
        </label>
        <textarea
          className="field mt-2.5"
          id="cf-message"
          name="message"
          rows={6}
          required
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy('message')}
          onBlur={onBlur('message')}
          onInput={onInput('message')}
        />
        {errors.message && (
          <span className={ERR} id="cf-message-err">
            {errors.message}
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
              <span className="btn-roll-face">{busy ? 'Sending' : 'Send message'}</span>
              <span className="btn-roll-face" aria-hidden="true">
                {busy ? 'Sending' : 'Send message'}
              </span>
            </span>
          </span>
          <span aria-hidden="true" className="btn-roll-glyph">→</span>
        </button>

        {/*
          role=status announces politely without stealing focus
          mid-typing. The wording carries the meaning on its own, so
          it never depends on colour to be understood.
        */}
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
