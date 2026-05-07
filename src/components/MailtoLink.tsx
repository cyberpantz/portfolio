export default function MailtoLink() {
  const u = 'phranque.y';
  const d = 'gmail';
  const t = 'com';
  const email = `${u}@${d}.${t}`;
  return (
    <a
      href={`mailto:${email}`}
      className="text-[15px] text-fg-sub no-underline transition-colors hover:text-fg"
    >
      {email} ↗
    </a>
  );
}
