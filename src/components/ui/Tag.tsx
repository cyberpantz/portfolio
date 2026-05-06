interface TagProps {
  label: string;
  tone?: 'accent' | 'gray';
}

/** Small monospace pill. Tone controls accent vs. neutral styling. */
export function Tag({ label, tone = 'accent' }: TagProps) {
  if (tone === 'gray') {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-sm border border-rule-strong bg-ink-surface
                       font-mono text-[11px] text-fg-sub tracking-[0.04em] whitespace-nowrap">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-sm border border-accent/30 bg-accent/10
                     font-mono text-[11px] text-accent tracking-[0.04em] whitespace-nowrap">
      {label}
    </span>
  );
}
