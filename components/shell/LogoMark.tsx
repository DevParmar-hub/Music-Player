/** A record seen from above: grooves, a teal label and a pink spindle. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" className="fill-fg" />
      <circle cx="16" cy="16" r="11.5" fill="none" className="stroke-bg" strokeOpacity="0.35" />
      <circle cx="16" cy="16" r="9" fill="none" className="stroke-bg" strokeOpacity="0.25" />
      <circle cx="16" cy="16" r="5.5" className="fill-teal-500" />
      <circle cx="16" cy="16" r="1.4" className="fill-pink-500" />
    </svg>
  );
}
