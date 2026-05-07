export default function MailtoLink() {
  const email = `phranque.y${String.fromCharCode(64)}gmail.com`;
  return (
    <a
      href={`mailto:${email}`}
      className="text-[15px] text-fg-sub no-underline transition-colors hover:text-fg"
    >
      {email} ↗
    </a>
  );
}
